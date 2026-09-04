# Sketch-Thru-Plan SDK Resources - Change Log

## Unreleased - BREAKING: symbology enum values renamed on the wire

**Breaking change for anything that compares STP symbology values as strings.**

The STP engine renamed four symbology enums so their names match the values its symbol tables have
always authored. Those names reach the JSON wire verbatim - the bridge serializes them with
`.ToString()` - so the strings STP sends have changed. The published OpenRPC contract, its
conformance checker and the property tables in the READMEs are updated to match.

| property | was | now |
|---|---|---|
| `affiliation` | `assumedfriend` | `assumed_friend` |
| `affiliation` | `suspected` | `suspect` |
| `echelon` | `armygroup` | `army_group` |
| `modifier` | `dummy` | `feint_dummy` |
| `modifier` | `dummy_hq` | `feint_dummy_hq` |
| `modifier` | `dummy_task_force` | `feint_dummy_task_force` |
| `modifier` | `dummytask_force_hq` | `feint_dummy_task_force_hq` (also gains the missing underscore) |

To migrate, update any comparison or lookup keyed on the old values - e.g.
`symbol.affiliation === 'assumedfriend'` becomes `=== 'assumed_friend'`. The renames are mechanical
and one-to-one; no value was added, removed or merged. TypeScript users get the same change in the
`sketch-thru-plan-sdk` package (`stptypes.ts`), whose own CHANGELOG carries the type-level note.

**Why:** the SDK's enum member names had drifted from the vocabulary the engine's tables author, so
the same concept was spelled two ways depending on which side you asked. `feint_dummy` and
`suspect` are the doctrinal terms; the old names had lost meaning.

**Why it went unnoticed:** `check-openrpc.js` validates the contract's `Affiliation` enum against
its own hard-coded expected list. Both were stale, so they agreed with each other while both
disagreed with what STP actually sends - a check that compares an artifact to a copy of itself can
only confirm what it already assumes. Both are corrected here, and they now agree with the wire.

Updated: `json-api/sketch-thru-plan-api.json`, `json-api/check-openrpc.js`,
`plugins/renderers/README.md`, `samples/basic/README.md`, `samples/to/README.md`.
