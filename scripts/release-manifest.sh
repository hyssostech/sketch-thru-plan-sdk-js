#!/usr/bin/env bash
#
# STP-709 - build and verify the SHA256SUMS manifest for a GitHub Release.
#
#   release-manifest.sh generate <dir>   write SHA256SUMS over <dir>
#   release-manifest.sh verify   <dir>   prove SHA256SUMS still describes <dir>
#
# WHY THERE ARE TWO SUBCOMMANDS, AND WHY VERIFY IS THE ONE THAT MATTERS
#
# 'generate' enumerates the directory and hashes what it finds, so its own
# entry-count assertion can never catch a file that was added afterwards - it
# would simply have hashed that file too. The failure this guards against is a
# manifest that covers a DIFFERENT set of files than the release page carries,
# which is what happens when the manifest is built before the asset set is
# final. So 'verify' re-enumerates the directory at the moment of upload and
# fails on any difference in either direction:
#
#   - a file present in the directory but absent from SHA256SUMS
#     (sha256sum -c alone CANNOT detect this: it only walks the manifest)
#   - a file listed in SHA256SUMS but absent from the directory
#   - a listed file whose content no longer matches its digest
#
# TWO FILES ARE STRUCTURALLY EXCLUDED, and this is not a loophole:
#
#   SHA256SUMS          cannot contain its own digest.
#   attestations.jsonl  is derived FROM SHA256SUMS by attest-build-provenance,
#                       so it does not exist at the moment SHA256SUMS is
#                       computed. It needs no manifest entry: it is the signed
#                       statement about SHA256SUMS, and tampering with it is
#                       caught by 'gh attestation verify', not by a digest.
#
# Every other asset on the release page must appear in SHA256SUMS. Dot-files
# are rejected outright rather than excluded, because 'gh release create
# <dir>/*' would not upload them and the manifest would then describe files the
# release page does not have.

set -euo pipefail

MANIFEST_NAME='SHA256SUMS'

die() {
  printf 'release-manifest: FAIL: %s\n' "$*" >&2
  exit 1
}

usage() {
  printf 'usage: %s {generate|verify} <dir>\n' "${0##*/}" >&2
  exit 2
}

# List the regular files in <dir> that the manifest must cover, sorted, one per
# line. Rejects dot-files rather than silently skipping them.
list_covered() {
  local dir="$1"
  local f
  (
    cd "$dir" || exit 1
    shopt -s nullglob dotglob
    for f in *; do
      [ -f "$f" ] || continue
      case "$f" in
        .*) printf 'DOTFILE:%s\n' "$f" ;;
        "$MANIFEST_NAME" | attestations.jsonl) ;;
        *) printf '%s\n' "$f" ;;
      esac
    done
  ) | LC_ALL=C sort
}

# Extract the file names recorded in SHA256SUMS, sorted. coreutils format is
# 64 hex digits, one space, then ' ' (text) or '*' (binary), then the name -
# which may itself contain spaces, so everything after that marker is the name.
manifest_names() {
  sed -n 's/^[0-9a-f]\{64\} [ *]//p' "$1" | LC_ALL=C sort
}

reject_dotfiles() {
  local listing="$1" dots
  dots="$(printf '%s\n' "$listing" | sed -n 's/^DOTFILE://p')" || true
  if [ -n "$dots" ]; then
    printf 'release-manifest: dot-file(s) in the release directory:\n' >&2
    printf '  %s\n' $dots >&2
    die "dot-files cannot be published by 'gh release create <dir>/*' and must not be staged"
  fi
}

generate() {
  local dir="$1" listing files count entries
  [ -d "$dir" ] || die "not a directory: $dir"

  listing="$(list_covered "$dir")"
  reject_dotfiles "$listing"
  files="$listing"

  [ -n "$files" ] || die "no files to hash in $dir - refusing to write an empty manifest"
  count="$(printf '%s\n' "$files" | wc -l | tr -d '[:space:]')"

  (
    cd "$dir" || exit 1
    : >"$MANIFEST_NAME"
    printf '%s\n' "$files" | while IFS= read -r f; do
      sha256sum -- "$f" >>"$MANIFEST_NAME"
    done
  )

  entries="$(wc -l <"$dir/$MANIFEST_NAME" | tr -d '[:space:]')"
  [ "$entries" = "$count" ] ||
    die "$MANIFEST_NAME has $entries entry/entries but $dir has $count file(s) to cover"

  printf 'release-manifest: generated %s over %s file(s):\n' "$MANIFEST_NAME" "$count"
  sed 's/^/  /' "$dir/$MANIFEST_NAME"
}

verify() {
  local dir="$1" listing present listed count entries
  [ -d "$dir" ] || die "not a directory: $dir"
  [ -f "$dir/$MANIFEST_NAME" ] || die "$dir/$MANIFEST_NAME does not exist"

  listing="$(list_covered "$dir")"
  reject_dotfiles "$listing"
  present="$listing"
  [ -n "$present" ] || die "no manifest-covered files in $dir - refusing to verify an empty asset set"
  listed="$(manifest_names "$dir/$MANIFEST_NAME")"

  count="$(printf '%s' "$present" | grep -c '' || true)"
  entries="$(printf '%s' "$listed" | grep -c '' || true)"

  local raw_lines
  raw_lines="$(wc -l <"$dir/$MANIFEST_NAME" | tr -d '[:space:]')"
  [ "$entries" = "$raw_lines" ] ||
    die "$MANIFEST_NAME has $raw_lines line(s) but only $entries parsed as sha256sum entries - malformed manifest"

  if [ "$present" != "$listed" ]; then
    printf 'release-manifest: %s does not describe %s\n' "$MANIFEST_NAME" "$dir" >&2
    printf '  in the directory but NOT in the manifest:\n' >&2
    comm -23 <(printf '%s\n' "$present") <(printf '%s\n' "$listed") | sed 's/^/    /' >&2
    printf '  in the manifest but NOT in the directory:\n' >&2
    comm -13 <(printf '%s\n' "$present") <(printf '%s\n' "$listed") | sed 's/^/    /' >&2
    die "the manifest was not regenerated after the asset set changed ($count file(s) present, $entries listed)"
  fi

  [ "$entries" = "$count" ] ||
    die "$MANIFEST_NAME lists $entries entry/entries but $dir has $count file(s) to cover"

  ( cd "$dir" && sha256sum --check --strict --quiet "$MANIFEST_NAME" ) ||
    die "at least one file's content does not match its recorded digest"

  printf 'release-manifest: verified %s over %s file(s); every digest matches.\n' "$MANIFEST_NAME" "$count"
}

[ $# -eq 2 ] || usage
case "$1" in
  generate) generate "$2" ;;
  verify) verify "$2" ;;
  *) usage ;;
esac
