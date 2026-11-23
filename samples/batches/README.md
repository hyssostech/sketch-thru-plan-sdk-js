# Batches sample

A load, an import, a sync or a join sends many object events in a row. STP 5.12 groups them into a **batch**:
`onBatchStarted` opens it, every object event it produces carries its `batchId`, and `onBatchEnded` closes it. A
client can therefore tell a bulk arrival from a lone edit without timing, and hold work - a pane refresh, a map
fit - until the batch ends. This sample shows which events arrived together.

Task history events are object events too; the [Task history sample](../taskhistory) shows those on their own.
The two are separate samples so that each reads on its own.

For prerequisites, script references and configuration, see the [Basic sample](../basic/README.md). The sample
loads this repository's build of the SDK; run `npm ci` and `npm run build:all` at the repository root first
(see [the samples README](../README.md)).

## Trying it

1. **Connect**: joining the session's scenario replays its objects as one batch with origin `replay`.
2. Sketch a few symbols: each arrives as a single edit, with no `batchId`.
3. **Save** keeps the scenario's text; **Load**, **Import** and **Sync** send it back, each as one batch
   (kinds `load`, `import`, `sync`). Hover over a row to see its events.
4. Open the sample in a second browser and do the same: the batches of the other client show `isOwn` false.

## Code walkthrough

```javascript
stpsdk.onBatchStarted = (batch) => {
    // batch.batchId, batch.kind ('load', 'import', 'sync', 'join', 'delete', ...),
    // batch.expected (-1 when unknown), batch.isOwn, batch.origin ('live' or 'replay')
};
stpsdk.onBatchEnded = (batch) => {
    // ... plus batch.status ('completed', 'cancelled', 'failed', 'abandoned', 'expired')
    // and batch.informs (how many object events the engine stamped with the batch)
};
// Every object event has a trailing batchId: undefined outside a batch
stpsdk.onSymbolAdded = (alternates, isUndo, batchId) => { /* ... */ };
stpsdk.onSymbolModified = (poid, symbol, isUndo, batchId) => { /* ... */ };
stpsdk.onSymbolDeleted = (poid, isUndo, batchId) => { /* ... */ };
// ... and the same for tasks, task orgs, task org units and relationships, and task history events
```

Handle the object events as they come; do not wait for `onBatchStarted`. An engine that predates batches sends
no batch events and no `batchId`, and a client that connects mid-batch sees events whose `onBatchStarted` it never
received - the sample lists those under a batch of kind `?`.
