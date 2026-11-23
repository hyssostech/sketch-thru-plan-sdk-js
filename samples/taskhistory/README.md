# Task history sample

STP 5.12 keeps a history for every task: what was done to it (created, edited, retasked, confirmed, deleted,
undone ...), by whom, in which role and from which component - and the comments people add to it. This sample
lists the tasks STP detects, shows the history of the one you pick, follows it live, and lets you add, edit and
delete your own comments.

For prerequisites, script references and configuration, see the [Basic sample](../basic/README.md) and, for how
tasks are detected, the [Tasks sample](../tasks/README.md). The sample loads this repository's build of the SDK;
run `npm ci` and `npm run build:all` at the repository root first (see [the samples README](../README.md)).

Query string parameters: `stpurl`, `user` (the person using the client - see below), `lat`/`lon`/`zoom`,
`azkey`/`azregion`/`azlang`/`azendp`, `inkonly`, `machineid`.

## Code walkthrough

### Register with a user

The history names the person behind each change and comment. Set the connector's `user` **before** connecting:
a client that registers without one cannot add comments (STP refuses them with "A comment needs its author").

```javascript
const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
stpconn.user = userName;
stpsdk = new StpSDK.StpRecognizer(stpconn);
```

### Read a task's history

`getTaskHistory` answers the entries newest first. Each item is `{ poid, entry }`: `poid` is the **entry's** id -
what `editTaskComment` and `deleteTaskComment` take - and `entry.task` is the task's. A task with no history, or an
unknown poid, answers `[]`. Entries outlive a deleted task, so the sample keeps deleted tasks in its list.

```javascript
const history = await stpsdk.getTaskHistory(taskPoid);
for (const { poid, entry } of history) {
    // entry.kind, entry.utc, entry.author, entry.role, entry.source, entry.text, entry.edited, entry.deleted
}
```

### Follow it live

```javascript
// A new entry - an edit, a confirm, a comment ... by any client
stpsdk.onTaskEventAdded = (poid, entry, batchId) => {
    if (entry.task === selectedTask) { history.unshift({ poid, entry }); renderHistory(); }
};
// A comment was edited or deleted by its author: the entry arrives whole
stpsdk.onTaskEventModified = (poid, entry, batchId) => { /* replace the entry with this poid */ };
```

### Comments

```javascript
// Answers the new entry's poid; onTaskEventAdded reaches every client
const entryPoid = await stpsdk.addTaskComment(taskPoid, text);
// Only the author may edit; the earlier text is kept in the entry's detail as revisions
await stpsdk.editTaskComment(entryPoid, newText);
// The comment stays as a tombstone (deleted set, no text), so others see it was deleted and by whom
await stpsdk.deleteTaskComment(entryPoid);
```

STP refuses (the promise rejects with its reason) blank text, a system entry, someone else's comment, and a
comment that was already deleted. The sample offers Edit and Delete only on the user's own standing comments.
