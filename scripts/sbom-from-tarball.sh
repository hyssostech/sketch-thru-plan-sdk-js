#!/usr/bin/env bash
#
# STP-708 - build the CycloneDX SBOM from the PACKED TARBALL, not the repo.
#
# WHY NOT THE REPO ROOT
#
# Generating at the repo root makes SBOM accuracy a function of repository
# layout, and the layout is about to change. Measured 2026-09-09 against the
# unpushed npm-workspaces conversion (workspaces: ["plugins/*/*"]), running the
# previous root-scoped command with --omit dev --omit optional --omit peer:
#
#   331 components, including all eight @hyssostech plugins, the whole AWS SDK,
#   Angular, the Azure speech SDK, vosk-browser - and sketch-thru-plan-sdk
#   listed as a component of itself.
#
# --omit dev does not help: a workspace member's dependencies are RUNTIME
# dependencies of the workspace root. The published package ships only dist/
# and declares two runtime dependencies. An SBOM listing nine plugins' trees
# would be worse than no SBOM, because it looks authoritative.
#
# HOW THIS IS IMMUNE BY CONSTRUCTION
#
# The extracted tarball contains package/package.json and package/dist only.
# There is no plugins/ directory inside it, so a "workspaces" glob - which
# npm pack does NOT strip from the manifest - matches nothing. Measured: a
# lockfile generated inside the extracted tree from the workspaces-era
# manifest contains ZERO plugins/ entries and ZERO @hyssostech entries.
# Nothing about the repository layout can reach this SBOM, now or later.
#
# WHY THE LOCKFILE IS GENERATED RATHER THAN COPIED IN
#
# npm never publishes a lockfile, so the extracted tree has none, and
# cyclonedx-npm needs one. Copying the repository's lockfile in would drag the
# workspace tree straight back: measured, seeding the extracted tree with the
# workspaces-era lockfile and regenerating leaves 9 stale plugins/ entries
# behind, because npm does not prune path entries whose directories are gone.
# Generating from scratch resolves exactly the dependencies the PUBLISHED
# manifest declares.
#
# The consequence, stated rather than hidden: resolution happens at release
# time against the registry, so the closure is the one a consumer installing
# this package would get, not the one pinned in the repository's lockfile.
# Those can differ when a dependency publishes a new version inside an
# existing semver range. Measured on 2026-09-09 they were identical
# (lodash 4.18.1, @types/geojson 7946.0.16).
#
# Extraction and the packed-file-set assertion happen in separate steps before
# this one, so that a changed pack surface is its own named gate rather than a
# side effect of SBOM generation.
#
# Usage:
#   sbom-from-tarball.sh <extracted-package-dir> <out-file> <spec-version> <cdx-pkg>
#
# Downstream assertions must be checked against <extracted-package-dir>/package.json
# - the SHIPPED manifest, not the repository's.

set -euo pipefail

PKGDIR="${1:?usage: sbom-from-tarball.sh <extracted-package-dir> <out-file> <spec-version> <cdx-pkg>}"
OUTFILE="${2:?missing <out-file>}"
SPEC="${3:?missing <spec-version>}"
CDXPKG="${4:?missing <cdx-pkg>}"

die() {
  printf 'sbom-from-tarball: FAIL: %s\n' "$*" >&2
  exit 1
}

[ -f "$PKGDIR/package.json" ] || die "no package.json in $PKGDIR - was the tarball extracted?"

# A lockfile is never published, so one is generated here from the packed
# manifest alone. --ignore-scripts because nothing in this tree should run.
printf 'sbom-from-tarball: resolving the published manifest'"'"'s dependencies\n'
( cd "$PKGDIR" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null )
[ -f "$PKGDIR/package-lock.json" ] || die "npm did not produce a lockfile in the extracted tree"

# Guard the property this whole approach rests on. If a plugins/ path or a
# sibling package ever turns up in this lockfile, the isolation has been
# breached and the SBOM must not be trusted.
#
# STP-730. This used `require(process.argv[1])`. `require` treats a RELATIVE
# path as a MODULE SPECIFIER and resolves it against node_modules, and
# release.yml passes a relative dir ("sbom-work/package") - so on its first
# real execution the guard died with MODULE_NOT_FOUND, having examined
# nothing. It had never run. It failed CLOSED (`set -e` aborts, no SBOM is
# produced), so nothing ever shipped unguarded - but the check this whole
# approach rests on was not actually being performed. fs.readFileSync takes a
# PATH rather than a specifier, which is what was meant all along.
#
# It now also reports how many entries it EXAMINED, and refuses at zero. A
# guard that finds no leaks because it parsed nothing is precisely the defect
# it exists to catch.
guard="$(node -e '
const fs = require("fs");
const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const keys = Object.keys(lock.packages || {});
const bad = keys.filter(
  (p) => p.startsWith("plugins/") || p.includes("@hyssostech"),
);
process.stdout.write(String(keys.length) + "\n" + bad.join("\n"));
' "$PKGDIR/package-lock.json")" || die "the isolation guard did not run"

examined="$(printf '%s' "$guard" | head -n 1)"
leaked="$(printf '%s' "$guard" | tail -n +2)"
case "$examined" in
  ''|*[!0-9]*) die "the isolation guard reported no entry count - it proved nothing" ;;
esac
[ "$examined" -gt 0 ] || die "the isolation guard examined 0 lockfile entries - it proved nothing"
printf 'sbom-from-tarball: isolation guard examined %s lockfile entries\n' "$examined"

if [ -n "$leaked" ]; then
  printf 'sbom-from-tarball: repository layout leaked into the extracted tree:\n' >&2
  printf '%s\n' "$leaked" | sed 's/^/    /' >&2
  die "the generated lockfile is not scoped to the published package"
fi

printf 'sbom-from-tarball: generating CycloneDX %s\n' "$SPEC"
( cd "$PKGDIR" && npx --yes "$CDXPKG" \
    --spec-version "$SPEC" \
    --output-format JSON \
    --output-file sbom.cdx.json \
    --mc-type library \
    --omit dev \
    --omit optional \
    --omit peer \
    --package-lock-only \
    package.json )

[ -s "$PKGDIR/sbom.cdx.json" ] || die "the generator produced no SBOM"
cp "$PKGDIR/sbom.cdx.json" "$OUTFILE"

printf 'sbom-from-tarball: wrote %s\n' "$OUTFILE"
