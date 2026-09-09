# Verifying a sketch-thru-plan-sdk release

Every check below is paired with what it does **not** prove. That pairing is
the point of this document. Each command answers one narrow question, and the
usual way supply-chain verification fails is not that a check returns the wrong
answer - it is that someone reads a passing check as an answer to a broader
question than the one it asked.

Jira STP-711.

---

## Start here: the package already has provenance nobody points at

`sketch-thru-plan-sdk@0.6.14` is published through npm Trusted Publishing
(OIDC) by `.github/workflows/publish-sdk.yml`, so npm already recorded a
genuine SLSA v1 provenance attestation for it. It has been there, unadvertised,
since that release. You can check it today, before any of the release assets
described further down exist:

```sh
npm view sketch-thru-plan-sdk@0.6.14 dist.attestations
```

That prints the attestation bundle's URL and the registry signature over it. To
check every installed package in one pass, including this one:

```sh
npm install sketch-thru-plan-sdk
npm audit signatures
```

**What this proves.** The registry holds a signed statement that a specific
GitHub Actions workflow, in a specific repository, at a specific commit, built
the exact tarball the registry is serving - and that the tarball you downloaded
matches the digest npm recorded for it.

**What this does not prove.**

- Not that the source at that commit is source you have read, or that it does
  what its README says. Provenance binds an artifact to a build; it makes no
  claim about the build's inputs being trustworthy.
- Not that the workflow was uncompromised. If the repository's Actions
  configuration had been subverted, the resulting artifact would carry equally
  valid provenance. Provenance tells you *where* something was built, not
  whether that place is honest.
- `npm audit signatures` in particular verifies the **registry's** signature
  over what it served. A pass means npm served the bytes it recorded. It is not
  a statement about who wrote them, and it is satisfied even by a package with
  no provenance at all - it will simply report that package as unsigned or
  unverified rather than failing.

---

## The release assets

From the release page for tag `sdk-v<version>`:

| File | What it is |
| --- | --- |
| `sketch-thru-plan-sdk-<version>.tgz` | the packed npm package |
| `sbom.cdx.json` | CycloneDX 1.6 SBOM of the runtime dependency closure |
| `trivy-report.json` | the raw vulnerability scan of that SBOM |
| `ci-summary.md` | generated gate results and measured counts (also the release body) |
| `VERIFYING.md` | this file |
| `SHA256SUMS` | digests of every file above |
| `attestations.jsonl` | build provenance attestation over `SHA256SUMS` |

`SHA256SUMS` covers every asset except two, and neither is an oversight:
it cannot contain its own digest, and `attestations.jsonl` is *derived from*
`SHA256SUMS`, so it does not exist at the moment the manifest is computed. The
attestation bundle needs no digest entry - it is the signed statement about the
manifest, and tampering with it is caught by `gh attestation verify`, below.

### 1. Check the files against the manifest

```sh
sha256sum --check --strict SHA256SUMS
```

**What this proves.** Each listed file has the content it had when the manifest
was written.

**What this does not prove.** Nothing at all about `SHA256SUMS` itself. Anyone
who can replace an asset can replace the manifest alongside it and this command
will happily report that everything matches. On its own it detects accidental
corruption, not tampering. Step 2 is what makes it mean something.

Note also that `sha256sum -c` only walks the manifest. It cannot tell you about
a file that was *added* to the release and left out of the manifest. Compare
the manifest's entries against the release page's asset list if that matters to
you - the workflow asserts this equality at upload time, but that assertion
lives in the run log, not in the artifact.

### 2. Verify the provenance of the manifest

Requires the GitHub CLI, authenticated.

```sh
gh attestation verify SHA256SUMS --repo hyssostech/sketch-thru-plan-sdk-js
```

Offline, against the bundle attached to the release:

```sh
gh attestation verify SHA256SUMS \
  --bundle attestations.jsonl \
  --repo hyssostech/sketch-thru-plan-sdk-js
```

**What this proves.** `SHA256SUMS` was produced by a GitHub Actions workflow in
this repository, and it has not changed since. Combined with step 1, that
extends to every file the manifest lists: the SBOM, the scan report, the
summary, and the tarball are all bound to that one signature. Swap any asset
and step 1 fails; swap the manifest to match, and step 2 fails.

**What this does not prove.**

- Not that the release is free of vulnerabilities, and not that the gates
  passed. It proves the *manifest* is authentic. `ci-summary.md` reports what
  the gates measured; provenance only assures you that the summary you are
  reading is the one the workflow wrote.
- Not that the tarball on this release page is the tarball on npm. See below.
- The offline form is weaker than it looks: verifying a bundle that arrived
  from the same place as the artifact only proves internal consistency. Prefer
  the first form, which fetches the attestation from GitHub.

### 3. Verify the npm tarball separately

**The tarball attached to the release is not the tarball npm serves.**
`npm publish` runs in a different workflow (`publish-sdk.yml`) on the same tag;
this release workflow re-packs from the same commit. The two builds are not
asserted to be byte-identical and, because the bundlers are not pinned to
reproducible output, they may well not be. Nothing here should be read as a
claim about the registry copy.

If what you install from npm is what you care about, verify that directly:

```sh
npm view sketch-thru-plan-sdk@<version> dist.integrity dist.shasum
npm pack sketch-thru-plan-sdk@<version>
shasum -a 1 sketch-thru-plan-sdk-<version>.tgz    # compare against dist.shasum
npm audit signatures
```

**What this proves.** That the bytes npm served match what npm recorded, and -
via `dist.attestations` and `npm audit signatures` - that npm holds a
provenance statement binding them to this repository's publish workflow.

**What this does not prove.** That the release-page tarball and the npm tarball
are the same bytes. If you need that, compare the *extracted contents* rather
than the archive digests: gzip framing, file ordering, and timestamps differ
between two independent packs of identical content.

### 4. Read the SBOM and the scan

```sh
# what the package actually depends on at runtime
jq -r '.components[] | "\(.group // "")\(if .group then "/" else "" end)\(.name)@\(.version)"' sbom.cdx.json

# re-run the scan yourself, on the SBOM that shipped
trivy sbom --severity CRITICAL,HIGH sbom.cdx.json
```

**What this proves.** Which packages the release declares, and what a scanner
says about them *today* - which may differ from what it said on release day, as
advisories are published continuously.

**What this does not prove.**

- Not that the SBOM describes the tarball's actual contents. It is derived from
  `package.json` and `package-lock.json`, which is the closure `npm install`
  reproduces. It is not derived from static analysis of `dist/`, and rollup
  inlines some dependencies into the UMD bundle.
- Not that a clean scan means safe. It means no *known, published* advisory
  matched a package in the SBOM at scan time.

If you re-run the scan, do not add `--ignore-unfixed`. That flag answers "is an
upstream fix available", not "am I exposed", and the release gate deliberately
omits it. A finding with no published fix is still a finding.

---

## What no check on this page covers

- **Anything about the seven `@hyssostech` plugins.** They version and publish
  independently from `plugins-v*` tags and are outside this release entirely.
- **The build environment itself.** Provenance records which workflow ran, not
  whether its runner, its action dependencies, or its registry mirrors behaved.
- **Test results.** `ci-summary.md` reports whether the suite passed. Neither
  the attestation nor the checksums say anything about what the tests covered.
- **Secret scanning and dependency audit for this tag.** Those gates live in
  `hardened-ci.yml`, which triggers on `main`, on pull requests, and on tags
  matching `v*` - a `sdk-v*` tag does not match. They ran when the commit
  landed on `main`, not when it was tagged. `ci-summary.md` records this as
  NOT PERFORMED rather than omitting it.
