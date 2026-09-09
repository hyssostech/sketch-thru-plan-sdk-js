#!/usr/bin/env bash
#
# STP-710 - render ci-summary.md, the body of the GitHub Release.
#
# TWO RULES, BOTH WRITTEN AGAINST A REAL DEFECT.
#
# RULE 1: EVERY NUMBER COMES FROM A JOB OUTPUT. There is not one literal count
# in this file. The STP engine's v5.10.8.0-rc5 release summary carried a
# hand-written "CVEs in STP application code or dependencies: 0" while the
# shipped SBOM listed a High (CVE-2025-6965). The number was not wrong because
# the scan was wrong; it was wrong because nothing connected the number to the
# scan. Here, an unset input renders NOT MEASURED - never 0. A count of zero
# in this document therefore means a scanner returned zero, and nothing else.
#
# RULE 2: A GATE THAT DID NOT RUN SAYS SO. GitHub reports a step that never
# executed as "skipped". The engine rendered that word as "SKIP", it read as
# "not applicable to this build", and it concealed a dead gate for 25
# consecutive runs. render_status() below cannot emit the string SKIP. Every
# non-success renders as DID NOT RUN with the reason attached, which is
# visually indistinguishable from a failure at a glance - deliberately.
#
# Controls that genuinely do not apply to a library repository are not omitted
# either. They get an explicit NOT PERFORMED line with a reason, because the
# absence of a line is indistinguishable from an oversight.
#
# Usage: ci-summary.sh <output-file>
# Inputs: environment variables (see GATES and the "figures" section).
# Outputs: publish_ok=true|false appended to $GITHUB_OUTPUT.

set -euo pipefail

OUT="${1:?usage: ci-summary.sh <output-file>}"

# gate key | env var holding the GitHub result | what it measured
GATES=(
  "Install|INSTALL_RESULT|npm ci - installs the locked dependency tree (which also runs the package's prepare script)"
  "Build|BUILD_RESULT|npm run build - tsc compile plus the three rollup bundles that make up dist/"
  "Unit tests|TEST_RESULT|npm test - the vitest suite"
  "Package|PACK_RESULT|npm pack - produces the tarball attached to this release"
  "Packed file set|PACK_CONTENTS_RESULT|the tarball contains exactly the expected files - nothing missing, nothing unexpected"
  "SBOM generation|SBOM_RESULT|CycloneDX SBOM over the published package's runtime dependency closure"
  "SBOM assertions|SBOM_ASSERT_RESULT|spec version, metadata version, dev-dependency exclusion, non-vacuous component list"
  "Vulnerability scan|SCAN_RESULT|Trivy sbom scan of that SBOM"
  "Vulnerability gate|SCAN_GATE_RESULT|no CRITICAL or HIGH finding, counted WITHOUT --ignore-unfixed"
)

# Map a GitHub result to a human status. The string SKIP is deliberately
# unreachable from this function.
render_status() {
  case "${1:-}" in
    success) printf 'PASS' ;;
    failure) printf 'FAIL' ;;
    cancelled) printf 'DID NOT RUN (cancelled)' ;;
    skipped) printf 'DID NOT RUN (skipped - an earlier gate failed, so this one never executed)' ;;
    '') printf 'DID NOT RUN (no result reported)' ;;
    *) printf 'DID NOT RUN (unrecognized result: %s)' "$1" ;;
  esac
}

# An absent figure is NOT a zero.
num() {
  if [ -z "${1:-}" ]; then printf 'NOT MEASURED'; else printf '%s' "$1"; fi
}

# The scan's figures are trustworthy only if the scan reported that it measured
# them. Anything else renders NOT MEASURED even when a stale value is present.
scan_num() {
  if [ "${SCAN_MEASURED:-}" != 'true' ]; then printf 'NOT MEASURED'; else num "${1:-}"; fi
}

publish_ok='true'

{
  printf '# Release evidence - %s %s\n\n' "$(num "${PKG_NAME:-}")" "$(num "${VERSION:-}")"
  printf 'Tag `%s`, commit `%s`.\n' "$(num "${TAG:-}")" "$(num "${COMMIT:-}")"
  printf 'Produced by `.github/workflows/release.yml`, run [%s](%s).\n\n' \
    "$(num "${RUN_ID:-}")" "$(num "${RUN_URL:-}")"
  printf 'Every figure in this document is read from a job output. None is written\n'
  printf 'by hand, so a zero here means a tool returned zero.\n\n'

  printf '## Gate results\n\n'
  printf '| Gate | Result | What it measured |\n'
  printf '| --- | --- | --- |\n'
} >"$OUT"

for spec in "${GATES[@]}"; do
  IFS='|' read -r label var desc <<<"$spec"
  value="${!var:-}"
  printf '| %s | %s | %s |\n' "$label" "$(render_status "$value")" "$desc" >>"$OUT"
  if [ "$value" != 'success' ]; then
    publish_ok='false'
  fi
done

# The eight gate strings can all say "success" while the scan reports that it
# measured nothing - the gate outcomes and the measurement flag are independent
# signals. Every current path that sets scan_measured=false also exits non-zero,
# so this is an unguarded invariant rather than a live defect; guard it anyway.
# Publishing a body that reads "Vulnerability gate | PASS" beside
# "HIGH: NOT MEASURED" is exactly the false attestation this file exists to
# prevent.
if [ "${SCAN_MEASURED:-}" != 'true' ]; then
  publish_ok='false'
fi

{
  printf '\n'
  printf 'A gate that did not run is shown as DID NOT RUN, never as SKIP. If any row\n'
  printf 'above is not PASS, this run did not publish a release.\n\n'

  printf '## Software Bill of Materials\n\n'
  printf -- '- Format: CycloneDX, spec version %s (pinned; asserted against the emitted document)\n' "$(num "${SBOM_SPEC:-}")"
  printf -- '- Generator: `%s`\n' "$(num "${SBOM_TOOL:-}")"
  printf -- '- Describes: `%s` version %s\n' "$(num "${SBOM_MC_NAME:-}")" "$(num "${SBOM_MC_VERSION:-}")"
  printf -- '- Components: %s\n' "$(num "${SBOM_COMPONENTS:-}")"
  printf -- '- Scope: the runtime dependency closure of the published package. devDependencies,\n'
  printf '  the samples, and the seven independently published `@hyssostech` plugins are\n'
  printf '  excluded, and that exclusion is asserted rather than assumed.\n'
  printf -- '- File: `sbom.cdx.json` on this release.\n\n'

  printf '## Vulnerability scan\n\n'
  printf -- '- Tool: Trivy %s, `sbom` mode, over `sbom.cdx.json`\n' "$(scan_num "${TRIVY_VERSION:-}")"
  printf -- '- Packages examined: %s\n' "$(scan_num "${PACKAGES_SCANNED:-}")"
  printf -- '- CRITICAL: %s\n' "$(scan_num "${VULN_CRITICAL:-}")"
  printf -- '- HIGH: %s\n' "$(scan_num "${VULN_HIGH:-}")"
  printf -- '- MEDIUM: %s\n' "$(scan_num "${VULN_MEDIUM:-}")"
  printf -- '- LOW: %s\n' "$(scan_num "${VULN_LOW:-}")"
  printf -- '- UNKNOWN: %s\n' "$(scan_num "${VULN_UNKNOWN:-}")"
  printf -- '- TOTAL: %s\n' "$(scan_num "${VULN_TOTAL:-}")"
  printf -- '- File: `trivy-report.json` on this release.\n\n'
  printf 'The gate counts findings **without** `--ignore-unfixed`. That filter answers\n'
  printf '"is an upstream fix available", not "are we exposed"; leaving it on is how a\n'
  printf 'sibling repository published "0 CVEs" while shipping a High whose advisory had\n'
  printf 'no patched version. A finding with no fix still counts here.\n\n'
  printf 'The count is over the packages examined, and "packages examined" is itself\n'
  printf 'asserted against the SBOM component count - a scanner that decodes nothing\n'
  printf 'reports zero findings and exits successfully.\n\n'

  printf '## Sealed before these gates ran\n\n'
  printf 'This document is one of the files covered by `SHA256SUMS`, so it has to be\n'
  printf 'final before the manifest is computed. Two gates therefore run after it is\n'
  printf 'sealed and cannot report their own result here:\n\n'
  printf -- '- SHA256SUMS coverage check (the manifest is re-verified against the staged\n'
  printf '  asset set immediately before upload)\n'
  printf -- '- Build provenance attestation over `SHA256SUMS`\n\n'
  printf 'Both are hard gates: if either had failed, the release would not have been\n'
  printf 'created and you would not be reading this file on a release page. That is an\n'
  printf 'inference from publication, not a measurement recorded here. The workflow run\n'
  printf 'linked above shows their actual outcome.\n\n'

  printf '## NOT PERFORMED\n\n'
  printf 'Listed rather than omitted, because a missing line is indistinguishable from\n'
  printf 'an oversight.\n\n'
  printf -- '- **Container image scan** - NOT PERFORMED. This repository publishes an npm\n'
  printf '  library; no image is built or shipped.\n'
  printf -- '- **OS package scan** - NOT PERFORMED. No operating-system layer ships with the\n'
  printf '  package, so there is no OS package set to scan.\n'
  printf -- '- **Byte-identity of the attached tarball against the npm registry tarball** -\n'
  printf '  NOT PERFORMED. `npm publish` runs in a separate workflow\n'
  printf '  (`.github/workflows/publish-sdk.yml`) on this same tag. The tarball attached\n'
  printf '  here is packed by this workflow from the same commit; it is not read back\n'
  printf '  from the registry, and the two builds are not asserted to be byte-identical.\n'
  printf '  See VERIFYING.md for how to check the registry copy yourself.\n'
  printf -- '- **Component analysis of the built bundles** - NOT PERFORMED. The SBOM is\n'
  printf '  derived from the manifest and lockfile, not from static analysis of\n'
  printf '  `dist/`. rollup inlines some runtime dependencies into the UMD bundle;\n'
  printf '  nothing here re-derives components from the emitted bytes.\n'
  printf -- '- **Static application security testing (SAST / code scanning)** - NOT\n'
  printf '  PERFORMED BY THIS WORKFLOW. Nothing here analyses the source or the built\n'
  printf '  bundles for vulnerable code patterns; every security figure above concerns\n'
  printf '  DEPENDENCIES, not this package'"'"'s own code. If a code-scanning workflow\n'
  printf '  exists in this repository it is gated by its own triggers, which this\n'
  printf '  document cannot observe - check the Actions tab for this commit.\n'
  printf -- '- **Secret scanning, npm audit, filesystem vulnerability scan, dependency\n'
  printf '  review** - NOT PERFORMED BY THIS WORKFLOW. They live in\n'
  printf '  `.github/workflows/hardened-ci.yml` and are gated by its own triggers, which\n'
  printf '  this document cannot observe. Whether they also ran for this commit is a\n'
  printf '  question for the Actions tab, linked above - do not infer either answer from\n'
  printf '  this line. Dependency review is pull-request only in any case, so it does not\n'
  printf '  run for a tag.\n\n'

  printf '## Verifying this release\n\n'
  printf 'See `VERIFYING.md`, attached to this release, for the commands - and for what\n'
  printf 'each one does and does not prove.\n'
} >>"$OUT"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  printf 'publish_ok=%s\n' "$publish_ok" >>"$GITHUB_OUTPUT"
fi

printf 'ci-summary: wrote %s (publish_ok=%s)\n' "$OUT" "$publish_ok"
