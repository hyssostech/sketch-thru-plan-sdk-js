# Security advisory dispositions

Advisories that were examined and deliberately NOT fixed by a dependency bump,
with the measurement behind each decision.

This file exists because a disposition that lives only in the GitHub Security
UI is one nobody finds later. When the same advisory reappears - a new lockfile,
a new alert number, a fresh clone - whoever meets it next needs the evidence,
not just the verdict. Each entry below records what was measured and how, so it
can be re-checked rather than taken on trust.

A dismissal is not a claim that the advisory is wrong. It is a claim about
whether THIS codebase reaches the vulnerable code. If that changes, so does the
disposition.

---

## GHSA-w5hq-g745-h8pq - uuid, missing buffer bounds check in v3/v5/v6

- Package: `uuid@9.0.0`, reached via `vosk-browser@0.0.8`
- Severity: moderate (CWE-787 out-of-bounds write, CWE-1285)
- Dependabot alert: sdk-js #2, dismissed as `not_used` on 2026-09-14
- `npm audit` verdict: `fixAvailable: false`

### Why it does not apply

The advisory requires `v3`, `v5` or `v6` to be called **with a `buf`
argument**. Measured inside the shipped `vosk-browser@0.0.8` bundle:

| generator | state in the bundle |
| --------- | ------------------- |
| `v6`      | not defined at all - it did not exist in uuid 9 |
| `v3`, `v5` | defined via `v35(...)`, but **zero call sites** |
| `v4`      | one call site: `this.id = v4();` - no `buf` argument |

The vulnerable functions are present as dead code and are never reached. Vosk
exposes no uuid API of its own, so a consumer cannot reach them either.

### Why an override would not have fixed it even if it did apply

This is the part worth remembering. `vosk-browser` declares `uuid: 9.0.0` as a
dependency, but it does not resolve it at runtime. Its shipped
`dist/vosk.js` - a 5.8 MB rollup bundle, and the target of **both** `main` and
`module` - has uuid's entire source **inlined**: `validate`, `parse`,
`byteToHex`, `v35`, `v4`, and the MD5 implementation for v3.

Across all six files in the package there are **zero** external
`require('uuid')` / `from 'uuid'` / `import('uuid')` references.

So an `overrides` entry would repoint `node_modules/uuid`, silence `npm audit`,
and leave the bytes that actually execute byte-identical. It would record a fix
that did not happen - which is worse than an open alert, because an open alert
is at least honest about the state of the code.

That is the general rule this entry is here to make concrete: **a vendored,
pre-bundled dependency cannot be patched by changing what npm resolves.** Check
for an external import before believing an override will do anything.

### What would actually fix it

Upstream rebuilding the bundle against a patched uuid. `0.0.8` is the current
release of `vosk-browser`, so there is nothing to bump to today.

### How to re-check this

The detector matters more than the result - a scan that silently measures
nothing will happily report "no external imports". Control it against a
known-dirty string first:

```
require('uuid')      must be DETECTED
import ... from 'uuid'   must be DETECTED
"the word uuid in prose"  must be IGNORED
```

Then scan every `.js`/`.mjs`/`.cjs`/`.ts`/`.json` file under
`node_modules/vosk-browser` (excluding nested `node_modules/`). A non-zero hit
count means the dependency is live again and this disposition must be revisited.

Re-open this if any of the following becomes true:
- `vosk-browser` publishes a release that resolves uuid externally, or
- a call site for `v3`/`v5`/`v6` with a `buf` argument appears, or
- a newer advisory covers `v4`.
