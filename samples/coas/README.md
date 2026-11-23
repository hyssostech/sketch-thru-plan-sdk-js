# Course of Action (COA) sample

A Course of Action (COA) is an alternative plan for one affiliation. Units, graphics and tasks that are sketched,
spoken or imported go into the **current** COA. This sample lists the scenario's COAs and lets you add, rename,
delete and select them, export one and import it back, and tie a task org to a COA - using the STP 5.12 COA API.

For prerequisites, script references and configuration, see the [Basic sample](../basic/README.md). The sample
loads this repository's build of the SDK; run `npm ci` and `npm run build:all` at the repository root first
(see [the samples README](../README.md)).

Query string parameters: `stpurl` (STP WebSocket URL), `user` (the person using the client), `lat`/`lon`/`zoom`,
`azkey`/`azregion`/`azlang`/`azendp` (Azure speech), `inkonly`, `machineid`.

## Code walkthrough

### The list comes from events

`AddCoa`, `UpdateCoa` and `DeleteCoa` are fire-and-forget: they have no result. STP confirms each with an event
that goes to every client of the session - this one included - so the sample keeps its list from the events
rather than from the calls. A refused call arrives as an `onStpMessage`.

```javascript
stpsdk.onCoaAdded = (poid, coa, isUndo, batchId) => { coas.set(poid, coa); renderCoas(); };
stpsdk.onCoaModified = (poid, coa, isUndo, batchId) => { coas.set(poid, coa); renderCoas(); };
stpsdk.onCoaDeleted = (poid, isUndo, batchId) => { coas.delete(poid); renderCoas(); };
// The current COA changed; a scenario reset clears it and the event then carries no COA
stpsdk.onCoaSwitched = (coa) => { currentCoa = coa?.poid; renderCoas(); };
```

There is no "list COAs" call. On connect (and with **Refresh list**) the sample reads every object of the
scenario and keeps the COAs:

```javascript
const objects = await stpsdk.getAllObjects();
for (const obj of objects ?? []) {
    if (obj?.fsTYPE === 'coa' && obj.poid) coas.set(obj.poid, obj);
}
```

### Add, rename, delete

```javascript
// The poid is assigned by STP and comes back in onCoaAdded
stpsdk.addCoa({ fsTYPE: 'coa', name: 'Plan B', affiliation: 'friend', creatorRole: 's3' });
// UpdateCoa (STP 5.12) sends the whole definition; onCoaModified confirms it
stpsdk.updateCoa(poid, { ...coa, name: 'Plan B (revised)' });
// onCoaDeleted confirms it
stpsdk.deleteCoa(poid);
```

### Select the current COA

`setCurrentCoa` is a request: it resolves once STP accepted it, and `onCoaSwitched` follows unless the COA was
already current. An unknown or deleted COA is refused - the promise rejects with STP's reason.

```javascript
await stpsdk.setCurrentCoa(poid);
```

### Export and import

`getCoaContent` returns the COA with its units, graphics and tasks as text ready to be persisted (task org units
and relationships are not part of it). `importCoaContent` keeps every poid in the text, so it brings back the very
COA that was exported, not a copy - delete the COA, then **Import exported**.

```javascript
const content = await stpsdk.getCoaContent(poid);
const importedPoid = await stpsdk.importCoaContent(content);
```

### A task org for one COA

`setCoaTaskOrg(toPoid, coaPoid)` ties a task org to one COA: while that COA is current it uses that task org instead
of the default for the task org's affiliation. `resetCoaTaskOrg({ coaPoid })` clears it (the task org itself is
not deleted). Engines before STP-1077 refuse a per-COA task org.

```javascript
await stpsdk.setCoaTaskOrg(toPoid, coaPoid);
await stpsdk.resetCoaTaskOrg({ coaPoid });
```
