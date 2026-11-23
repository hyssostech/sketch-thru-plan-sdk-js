# Object sets sample

Scenarios, task orgs and COAs can be read and written as **object sets**: JSON arrays of typed STP objects instead of
text. This sample reads one, saves it to a file and sends it back - replacing the scenario, merging into it, or
syncing the session - with a load timeout, and shows the report STP gives when a load is refused, stops part way or
runs out of time.

For prerequisites, script references and configuration, see the [Basic sample](../basic/README.md). The sample
loads this repository's build of the SDK; run `npm ci` and `npm run build:all` at the repository root first
(see [the samples README](../README.md)).

## Reading

```javascript
const scenario = await stpsdk.getScenarioObjectSet();
const taskOrg = await stpsdk.getTaskOrgObjectSet(toPoid);
const coa = await stpsdk.getCoaObjectSet(coaPoid);
```

Each object carries its content in `PrologTerm`, a string holding the object's STP text. Send the array back as it
was returned; an object without `PrologTerm` (other than a deletion marker) is refused before anything is applied.

## Writing, with a timeout

```javascript
const timeout = 90; // seconds
await stpsdk.loadNewScenarioFromObjectSet(objects, timeout);      // replace the scenario
await stpsdk.importPlanDataFromObjectSet(objects, timeout);       // merge into it
await stpsdk.syncScenarioSessionFromObjectSet(objects, timeout);  // apply the differences
const toPoid = await stpsdk.importTaskOrgFromObjectSet(objects, timeout);
const coaPoid = await stpsdk.importCoaFromObjectSet(objects, timeout);
```

The timeout bounds both the engine's load and this client's wait for the answer. While a load runs, the objects
it applies are announced as ordinary events (`onSymbolAdded`, `onCoaAdded`, ...); the sample counts them.

## The load report

A load is applied one object at a time, not all-or-nothing. When it does not complete, the call rejects with STP's
report:

* **Refused up front** - a missing `PrologTerm`, an old-form `PrologTerm`, unreadable text, an entry that is not an
  object. Nothing was applied. Tick *drop the last object's PrologTerm* to see one.
* **Stopped** - the engine rejected an object: the report names it and why, the objects **applied before it (they
  stay applied)**, any rejected and skipped, and those not applied. For example:
  `The object-set load stopped at object 8 of 8, task '...': STP rejected ... Applied before it (7): ... Not applied (1): ...`
* **Ran out of time** - the same kind of report: the objects applied, the object in flight (sent with no reply
  yet - the engine may still apply it) and those not sent. The engine also announces this report as an
  `onStpMessage`, which is all a client receives when its own timeout fires first (`Operation timed out`). The
  sample keeps the messages that arrive during the load and shows them in that case.

```javascript
try {
    await stpsdk.importPlanDataFromObjectSet(objects, timeout);
} catch (error) {
    // error.message is the report: "... Applied before it (n): ... Not applied (m): ..."
}
```

Engines before STP-1095 answer a timed-out load with "The operation was canceled.", naming nothing; engines before
STP-1090 cannot read `Get*ObjectSet` output back - use the text forms (`getScenarioContent` / `loadNewScenario`)
with those.
