#!/usr/bin/env bash
#
# Controls for scripts/release-manifest.sh (STP-709).
#
# This repository is where the script originated (STP-709), and it shipped
# without tests. It is the gate the whole release-integrity design turns on -
# SHA256SUMS is only a claim about "the published set" if something proves the
# manifest still describes that set - so the central control of BOTH SDKs was
# being taken on trust. sdk-net runs these same controls; this is the other
# half, against the original.
#
# The case that matters most is CASE 2. `sha256sum -c` walks the MANIFEST, so
# it cannot see a file that exists in the directory but is absent from the
# manifest. That is not hypothetical here: attaching attestations.jsonl after
# generating SHA256SUMS creates exactly that state on every release. A plain
# `sha256sum -c` would pass while the release page carried a file the manifest
# said nothing about - which is the entire reason this script exists instead of
# that one-liner. Case 2 and its companion CONTROL below encode that difference
# so it cannot quietly regress.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/../../../scripts/release-manifest.sh"

[ -f "$SCRIPT" ] || { echo "cannot find release-manifest.sh at $SCRIPT"; exit 1; }

failures=0
tmproot="$(mktemp -d)"
trap 'rm -rf "$tmproot"' EXIT

# Build a fresh, valid staging directory and generate its manifest.
fresh() {
  local d="$tmproot/$1"
  rm -rf "$d"; mkdir -p "$d"
  printf 'package bytes\n'  > "$d/pkg.nupkg"
  printf 'symbols\n'        > "$d/pkg.snupkg"
  printf '# verifying\n'    > "$d/VERIFYING.md"
  printf '{"c":[]}\n'       > "$d/sbom.cdx.json"
  bash "$SCRIPT" generate "$d" >/dev/null 2>&1 || { echo "SETUP FAILED for $1"; exit 1; }
  printf '%s' "$d"
}

check() { # label, dir, expect(pass|fail), must_mention
  local label="$1" dir="$2" expect="$3" mention="${4:-}"
  local out rc
  out="$(bash "$SCRIPT" verify "$dir" 2>&1)"; rc=$?
  local got="pass"; [ "$rc" -eq 0 ] || got="fail"
  local bad=""
  [ "$got" = "$expect" ] || bad="expected $expect, got $got (exit $rc)"
  if [ -z "$bad" ] && [ -n "$mention" ] && ! printf '%s' "$out" | grep -qi -- "$mention"; then
    bad="message did not mention '$mention'"
  fi
  if [ -n "$bad" ]; then
    failures=$((failures + 1))
    echo "  WRONG  $label"
    echo "         $bad"
    printf '%s\n' "$out" | sed 's/^/         /'
  else
    echo "  OK     $label"
  fi
}

echo "=== the happy path must still pass ==="
d="$(fresh good)"
check "an untouched staged set verifies" "$d" pass "every digest matches"

echo
echo "=== CASE 2: a file present but NOT in the manifest ==="
d="$(fresh added)"
printf 'snuck in\n' > "$d/unlisted.txt"
check "an unlisted file must FAIL" "$d" fail "NOT in the manifest"

echo "  --- CONTROL: prove plain 'sha256sum -c' does NOT catch this ---"
if ( cd "$d" && sha256sum --check --strict --quiet SHA256SUMS >/dev/null 2>&1 ); then
  echo "  OK     sha256sum -c passes the same directory - which is exactly why"
  echo "         this script exists instead of that one-liner. The control holds."
else
  failures=$((failures + 1))
  echo "  WRONG  sha256sum -c rejected it, so this test no longer demonstrates"
  echo "         the gap that motivated the change. Re-derive the rationale."
fi

echo
echo "=== a file listed but missing from the directory ==="
d="$(fresh removed)"
rm -f "$d/sbom.cdx.json"
check "a missing listed file must FAIL" "$d" fail "NOT in the directory"

echo
echo "=== a listed file whose content changed ==="
d="$(fresh tampered)"
printf 'tampered bytes\n' > "$d/pkg.nupkg"
check "a digest mismatch must FAIL" "$d" fail "does not match"

echo
echo "=== the two structural exclusions are not loopholes ==="
d="$(fresh excluded)"
printf '{"payload":"..."}\n' > "$d/attestations.jsonl"
check "attestations.jsonl added after generate must PASS" "$d" pass "every digest matches"

echo
echo "=== a dot-file cannot be published by 'gh release create <dir>/*' ==="
d="$(fresh dotfile)"
printf 'x\n' > "$d/.hidden"
check "a dot-file must FAIL rather than be skipped" "$d" fail "dot-file"

echo
echo "=== an empty set is not a valid release ==="
d="$tmproot/empty"; rm -rf "$d"; mkdir -p "$d"
printf '' > "$d/SHA256SUMS"
check "an empty asset set must FAIL" "$d" fail "refusing"

echo
echo "=== a malformed manifest is not a manifest ==="
d="$(fresh malformed)"
printf 'this is not a sha256sum line\n' >> "$d/SHA256SUMS"
check "unparseable manifest lines must FAIL" "$d" fail "malformed"

echo
if [ "$failures" -gt 0 ]; then
  echo "$failures control(s) did not behave as required."
  exit 1
fi
echo "All controls behaved as required: the manifest gate rejects every way the"
echo "staged set can drift from what SHA256SUMS describes, and accepts a good set."
