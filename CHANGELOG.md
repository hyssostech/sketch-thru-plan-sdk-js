# Sketch-Thru-Plan Change Log
## Version 0.6.17 - BREAKING: task enum values now match the wire
- BREAKING: `TaskWhat`, `TaskHow`, `TaskWhy` and `TaskROE` values are now the engine's
  member names, which is what the engine sends: `"ambush"` -> `"AMBUSH"`,
  `"cordon_and_search"` -> `"CORDON_AND_SEARCH"`, `"hold"` -> `"Hold"`. The old
  lower-case values never matched a live task, so `task.what === TaskWhat.Ambush` was
  always false; it now works. Update any comparison keyed on the old strings
- Fixed rules of engagement never arriving: the engine sends and reads it as `roe`,
  and `StpTask` declared `rulesOfEngagement`. `StpTask.roe` added;
  `rulesOfEngagement` is a deprecated alias of it, and a task sent with `addTask` or
  `updateTask` now carries `roe` where the engine reads it
- Fixed C2SIM rules of engagement never applying: `StpC2SIMOptions.rulesOfEngagement`
  took `'ROEHold'`, `'ROEFree'` and `'ROETight'`, which the engine ignored, keeping its
  configured default. It now takes the engine's `'Hold'`, `'Free'` and `'Tight'`; the old
  spellings are deprecated and sent as the engine value (STP-694)
- Added `StpC2SIMOptions.validationSchema` and `includeDescriptionInName`, two keys the
  engine accepted that the SDK could not set
- OpenRPC contract raised to 0.5.0: the C2SIM `options` keys of `GetC2SIMContent`,
  `PullC2SIMInitialization` and `PushC2SIMContent` are spelled as `StpC2SIMOptions` sends
  them (`resturl` -> `restUrl`, `fullto` -> `fullTO`, ...), so a strict schema validator
  accepts what the SDK sends; the engine accepts any casing (STP-694)
- Fixed `disconnect()` leaving a live connection open: it closed the socket only when
  the socket was not open (STP-1070). It now closes an open or connecting socket, does
  not reconnect afterwards, and does nothing when the socket is already closing or closed
- `@deprecated` tags now reach the published type definitions; the build had been
  stripping every doc comment from them
- Added `TaskWhat.HarassmentFires` (`HARASSMENT_FIRES`), the corrected spelling the
  engine uses since STP-1019; `TaskWhat.HarrassmentFires` is deprecated
- Added the 11 `TaskWhat` members the engine had that this SDK lacked: `Canalize`,
  `Contain`, `Control`, `Counterreconnaissance`, `Disengage`, `Exfiltrate`, `Interdict`,
  `Isolate`, `Reduce`, `Suppress`, and `Demonstrating` (deprecated)
- Deprecated the task values the engine no longer produces: `TaskWhat.Looting`,
  `Rioting`, `SeekRefuge`, `Demonstrating` and `TaskHow.Civilian` (STP-1001),
  `TaskHow.Insurgent` and `NgoOperation` (STP-1019). They stay until the next major
  release so older servers and saved data still compare
- OpenRPC contract: `TaskROE` values and the task enum descriptions corrected to the
  wire spelling
- Fixed `resetCoaTaskOrg` sending `SetCoaTaskOrg`, with the COA poid as `affiliation`
  and the timeout as `coaPoid`; it now sends `ResetCoaTaskOrg`. It also accepts
  `{ affiliation, coaPoid }`, so `resetCoaTaskOrg({ affiliation: 'friend' })` resets the
  default task org for an affiliation; a plain string is still taken as the COA poid
- Documented the COA methods as the engine now dispatches them (STP-1058), and
  `importCoaContent`, `importTaskOrgContent` and their object-set forms keep the poids
  in the content rather than generating new ones
- OpenRPC contract raised to 0.6.0: the eight COA methods (`AddCoa`, `UpdateCoa`,
  `DeleteCoa`, `SetCurrentCoa`, `GetCoaContent`, `ImportCoaContent`, `SetCoaTaskOrg`,
  `ResetCoaTaskOrg`) lose `x-engineDispatch: none` and are described as dispatched;
  `ResetCoaTaskOrg` gains `affiliation`; `CoaAdded`, `CoaModified` and `CoaDeleted` added
  to `x-stpEvents`; the "fresh unique IDs" claim on the four import methods corrected
- OpenRPC contract raised to 0.6.1: per-COA task orgs described. `coaPoid` on
  `SetCoaTaskOrg` ties a TO to one COA; on `ResetCoaTaskOrg` it clears that tie, for one
  affiliation or all of them. Engines before STP-1077 refuse a `coaPoid`
- OpenRPC contract raised to 0.7.0 (STP-1059): every method carries `x-stpSafety`
  (`read` / `write` / `destructive`); the 35 fire-and-forget methods carry
  `x-stpInform`; the two calls that reach the C2SIM server carry `x-stpOpenWorld`.
  Descriptions corrected from the engine source: the imports and `SyncScenarioSession`
  REPLACE resident objects with the same poid and keep the rest (sync does not discard
  the current scenario); `PushC2SIMContent` sends to the external C2SIM server and
  imports nothing; `PullC2SIMInitialization` returns the content without loading it
- OpenRPC contract raised to 0.8.0 (STP-1059): every method carries `x-stpEmits`, the
  events that follow a call - each with `when` (`always` / `if` / `may`), a `condition`
  and `to` (`caller` / `session`); reads emit nothing except the `JoinScenarioSession`
  replay. Methods the engine does not yet serve as described carry `x-stpKnownIssues`
  (STP-1077 per-COA task orgs, STP-1078 COA events, STP-1079 COA and role switch waits,
  STP-1080 undo, discarded ink, task confirm/update and TO relationship events).
  Descriptions corrected: `NewScenario` goes to the other clients of the session, never
  the caller; `JoinScenarioSession` replays no `TaskOrgAdded`; `SetSpeechListening`
  reports no event; `SpeechRecognized` carries the single phrase that integrated; imports
  report a replaced object as `*Added`, not `*Modified`
- OpenRPC contract raised to 0.9.0 (STP-1059). Every method now carries an `examples`
  pairing captured from a live engine, with the events it produced (`x-stpEventsObserved`),
  and `x-stpEdgeCases`: what the engine did with bad or unusual input (`refused`,
  `announced`, `ignored` or `accepted`), 197 cases across the methods.
  - `CreateNewScenario` returns the new scenario's poid, not null (STP-1087).
  - `x-stpKnownIssues` changes:
    - STP-1078 and STP-1079 are fixed, so they are no longer listed;
    - added STP-1088 (task-org unit and relationship parameter names);
    - added STP-1089 (relationship events);
    - added STP-1090 (the object-set round trip);
    - added STP-1091 (writes that do not validate their target).
- OpenRPC contract raised to 0.9.1 (STP-1059): every method description is rewritten for a
  model reader. Each says when to use the method rather than its neighbours, what must exist
  first, what the call changes and what comes back. Fire-and-forget methods say that only
  events answer. Corrected from the engine source and the live capture:
  - `ResetStpScenario` discards the scenario too;
  - `PullC2SIMInitialization` returns only the XML;
  - `SetRole` ignores `createIfNone` and sets the client's own role;
  - `ConfirmTask` always confirms;
  - `ResetSegmentationTimeout` leaves the wait timeout;
  - `ResetRole` leaves no role;
  - `ResetDefaultTaskOrg` resets the friend default for any value but `hostile`;
  - the object-set and `GetAllObjects` JSON carries content only in the engine term.
  - STP-1088 is fixed in the engine (STP#348), so it is no longer listed. Engines before it drop
    `toUnit` / `toRelationship`, and the descriptions say so.
- Added `json-api/sketch-thru-plan-validations.json` and its schema (STP-1064): the shared rule set
  a client evaluates around every state-changing call - preconditions, required params and poid
  references before it, and the events that prove it was done after it. See the JSON API README,
  "Call validations"
- OpenRPC contract raised to 0.9.2 (STP-943): STP-1089, STP-1080 and STP-1083 are fixed in the
  engine, so they are no longer listed in `x-stpKnownIssues`; each description keeps one sentence
  on what an engine before the fix does. Re-captured from a live engine:
  - `AddTaskOrgRelationship`, `UpdateTaskOrgRelationship` and `DeleteTaskOrgRelationship` send
    `TaskOrgRelationshipAdded` / `Modified` / `Deleted`, one each, to every client in the session.
    An `AddTaskOrgRelationship` whose parent and child are unknown is stored and announced too;
  - `UndoLastOp` replays the undone operation as `*Added` / `*Modified` / `*Deleted` with
    `isUndo: true`, to every client in the session, for symbols, tasks, task org units and
    relationships. Undoing a task add takes two calls (the add is followed by a change);
  - `UpdateTask` sends `TaskModified`. Alternates carrying an out-of-date `dbVersion` (taken from an
    earlier event) are dropped silently - a new edge case;
  - `ConfirmTask` honours `isConfirmed`: `false` sets `uiStatus` back to `confirming`; omitted, it
    confirms;
  - a sketch that is not recognized (`SendInk`, `RecognizeNow`) still sends `InkProcessed`, about
    10 s later;
  - `JoinScenarioSession` and `GetScenarioContent` work after an undone add (STP-1083);
  - `SendInk` without `strokePoints`, or with a malformed time, is announced with an `StpMessage`
    (since STP-1088), no longer ignored.
- Call-validation rules 1.0.1, checked against contract 0.9.2: the relationship methods and
  `UpdateTask` expect their events again; no rule marks events unverifiable
- `confirmTask`, `updateTask`, `undoLastOp` and the task org relationship methods say in their
  doc comments what an engine before STP-1080 / STP-1089 does
- OpenRPC contract raised to 0.9.3 (STP-943): STP-1090 is fixed in the engine, so the eight
  object-set methods no longer list it in `x-stpKnownIssues`; each description keeps one sentence
  on what an engine before the fix does. Re-captured from a live engine:
  - `GetCoaObjectSet`, `GetTaskOrgObjectSet` and `GetScenarioObjectSet` carry each object's
    `PrologTerm` as a string, the object's STP text (the text `Get*Content` returns), and their
    output is valid input for the matching `*FromObjectSet` import as it is;
  - the five imports (`ImportCoaFromObjectSet`, `ImportTaskOrgFromObjectSet`,
    `ImportPlanDataFromObjectSet`, `LoadNewScenarioFromObjectSet`,
    `SyncScenarioSessionFromObjectSet`) read that text back. Refused before anything is applied,
    with the object named: an object without `PrologTerm` (a deletion marker aside), the old array
    form, text that is not an object, an entry that is not an object. A load the engine stops part
    way answers `success: false` naming the object that stopped it, what was applied before it and
    what was not - new edge cases for each, with the captured messages;
  - the loads are not all-or-nothing: objects applied before the one that stopped a load stay
    applied and announced. `ImportPlanDataFromObjectSet` of a `GetScenarioObjectSet` output adds a
    second `planning_scenario`, as `ImportPlanData` does with the text;
  - `GetAllObjects`, `GetTaskOrgObjects` and `GetScenarioContent` no longer call the JSON forms
    large. `PrologTerm` stays out of the examples (STP-1085); the examples say so.
- Call-validation rules 1.0.2, checked against contract 0.9.3; no rule changed
- The object-set methods say in their doc comments that `get*ObjectSet` output round-trips into
  the matching import, what is refused, that a load is not all-or-nothing, and what an engine
  before STP-1090 does
- OpenRPC contract raised to 0.9.4 (STP-943): STP-1091 is fixed in the engine, so `UpdateTask`,
  `UpdateTaskOrg`, `AddTask`, `AddTaskOrgUnit`, `SetDefaultTaskOrg`, `ResetDefaultTaskOrg`,
  `SetCoaTaskOrg` and `SetRole` no longer list it in `x-stpKnownIssues`. Each description keeps
  one sentence on what an engine before the fix does. Edge cases re-captured from a live engine:
  - `UpdateSymbol`, `UpdateTask`, `UpdateTaskOrg`, `UpdateTaskOrgUnit`,
    `UpdateTaskOrgRelationship` and `UpdateCoa` refuse a missing or unknown poid, or one that
    names a deleted object or an object of another type. The refusal is an `StpMessage`, or
    `success: false` through `Request`, and nothing changes. Before the fix the engine ignored an
    unknown poid, `UpdateTask` stored a new task under it, and a cross-type update rewrote the
    object's type. The `*Deleted` "instead" events and `UpdateTask`'s `TaskAdded` are no longer
    listed in `x-stpEmits`; `StpMessage` is listed on these methods for the refusal;
  - `AddTask` with a `who`, and `AddTaskOrgUnit` with a `parentTO`, that names no live object is
    refused, with no orphan created;
  - `SetDefaultTaskOrg` and `SetCoaTaskOrg` refuse a missing or unknown TO poid, or one that is
    not a TO; `SetRole` refuses an unknown role; `ResetDefaultTaskOrg` and `ResetCoaTaskOrg`
    take only `friend`, `hostile` or `any`, so a missing `affiliation` no longer clears the
    friend default;
  - `SetCurrentCoa` refuses an unknown poid at once, not after 10 s;
  - `ResetDefaultTaskOrg` and `SetDefaultTaskOrg` answer a client that has a current COA; before
    the fix they timed out. Writes with no active scenario are still accepted (the
    `no active scenario` cases).
- Call-validation rules 1.0.3, checked against contract 0.9.4; no rule changed. The engine now
  enforces the `references` of the methods above itself
- OpenRPC contract raised to 0.9.5 (STP-943):
  - STP-1077 is fixed in the engine: per-COA task orgs. `SetCoaTaskOrg` / `ResetCoaTaskOrg` with
    `coaPoid` bind / clear a task org for one COA instead of being refused. The binding is stored on
    the COA - the new `StpCoa` fields `friendTaskOrg` / `hostileTaskOrg` - so it is saved with the
    scenario; `CoaModified` goes to every client and `TaskOrgSwitched` to each client whose current
    COA it is. Deleting a bound task org clears the binding (`CoaModified` on `DeleteTaskOrg`). The
    two methods no longer list STP-1077 in `x-stpKnownIssues`; edge cases re-captured live.
  - STP-1095: the five `*FromObjectSet` imports refuse a missing `objects` naming the parameter,
    and `ImportPlanDataFromObjectSet` / `ImportPlanData` leave the content's `planning_scenario` out
    (a second one used to be added). Each description says what an engine before the fix does.
- `StpCoa` gains `friendTaskOrg` and `hostileTaskOrg`
- Call-validation rules 1.0.4, checked against contract 0.9.5; no rule changed
- Change sets (STP-1265): new `onBatchStarted(batch)` and `onBatchEnded(batch)` handlers. The engine now groups a
  bulk operation's object events - a load, an import, a reconcile, a Confirm all, a multi-delete, a join's replay - into
  a change set, and every object handler (`onSymbolAdded` ... `onCoaDeleted`) receives the change set's id as a new
  optional trailing `batchId` argument, `undefined` outside one. Existing handlers are unaffected. A client can tell a
  bulk arrival from a lone add without timing; do not wait for `onBatchStarted`, an older engine sends none.
  New types `StpBatchStarted` and `StpBatchEnded`
- OpenRPC contract raised to 0.9.8 (STP-1265): events `BatchStarted` and `BatchEnded`, and a trailing nullable
  `batchId` param on the 18 object events
- Call-validation rules 1.0.7, checked against contract 0.9.8; no rule changed
- OpenRPC contract raised to 0.9.7 (STP-973): new C2SIM option `refuseUnconfirmedPlaceholders` (boolean, default
  false) on `GetC2SIMContent`, `PullC2SIMInitialization` and `PushC2SIMContent`, and on `StpC2SIMOptions`. The engine
  now reads the placement grade COARenderer stamps on each graphic and warns, per task, about every estimate staff have
  not confirmed; with this option a rung-5 placeholder refuses the document instead. It has an effect only where the
  engine builds the document (`GetC2SIMContent`); a pull or a push of a ready document accepts and ignores it
- Call-validation rules 1.0.6, checked against contract 0.9.7; no rule changed
- OpenRPC contract raised to 0.9.6 (STP-943): STP-1095 - a `*FromObjectSet` load cut off by the
  request timeout answers `success: false` with a report like that of a load that stops: the objects
  applied, any skipped, the object in flight (sent with no reply yet; the engine may still apply it) and
  those not sent. The report is also announced as `StpMessage`, which is all a client whose own timeout
  fired first receives. Before, the answer was "The operation was canceled.", naming nothing. New edge
  case on `ImportPlanDataFromObjectSet`, captured live
- Call-validation rules 1.0.5, checked against contract 0.9.6; no rule changed

## Version 0.6.16
- Fixed `connect()` opening a second WebSocket when called on an already-connected
  instance; a redundant `connect()` now updates the registration in place
- Hardened the release path: publish credentials and third-party install code no
  longer share a job, GitHub Actions are SHA-pinned and enforced, the plugin pack
  surface and release manifest are gated, and a package whose content changed
  without a version bump now fails the build
- CDN subresources in the samples are pinned to exact versions and carry SRI,
  including those loaded dynamically from JavaScript rather than script tags
- SonarQube analysis configured, its coverage import fixed, and the XSS sinks in
  the samples closed
- Documentation corrected for the workspace build - bundles are generated rather
  than committed - and the generated API index links fixed

## Version 0.6.15
- Added 17 methods matching dispatch arms the engine already exposed:
  `advertiseViewport`, `changeTimeOut`, `getActiveScenarioDescription`,
  `getAllObjects`, `getDeletedObjects`, `getPoidObject`, `getScenarioTaskOrgList`,
  `getTaskOrgObjects`, `recognizeNow`, `resetRole`, `resetSegmentationTimeout`,
  `resetStpScenario`, `sendAudioCaptureState`, `sendListen`, `setAutoTasking`,
  `setSpeechListening`, `undoLastOp`
- Added handling for three events the engine emits but the SDK could never
  receive: `onNewScenario`, `onSpeechDiscarded`, `onSpeechParsed`
- Restored `onCoaSwitched`, whose dispatch arm was commented out
- Added `refreshSubscriptions()`, so handlers attached after `connect()` are routed
- OpenRPC contract raised to 0.4.0: the added methods documented, transport-level
  messages marked `x-layer`, and the C2SIM `options` keys enumerated

## Version 0.6.14 - BREAKING: symbology enum values renamed on the wire
- BREAKING: `assumedfriend` -> `assumed_friend`, `suspected` -> `suspect`,
  `armygroup` -> `army_group`, `dummy*` -> `feint_dummy*`. Update any comparison
  keyed on the old strings
- The SDK source and its tests now live in this repository as the canonical
  `sketch-thru-plan-sdk`; they were previously maintained separately
- Fixed the `modifier` union declaring `'task_force '` with a trailing space, so
  `modifier === 'task_force'` could never match

## Version 0.6.13-alpha.0
- Added `sendSimulatedSpeechRecognition()` method to send typed text as simulated speech recognition
- Added `extensions` property to `StpItem`, `StpTaskOrg`, and `StpTaskOrgRelationship` for roundtripping custom client data through STP

## Version 0.6.12
- Updated package versions

## Version 0.6.11
- Added C2SIM task property: rulesOfEngagement
- Added parameter to toggle task confirmation from/to un/confirmed
- Added Task Org Unit property that contains the speech phrases generated from the `name`

## Version 0.6.10
- Added C2SIM configuration parameters: includeMapGraphicId, entityNameCharLimit, rulesOfEngagement

## Version 0.6.9 
- Added C2SIM properties to symbols: DIS code, federate, resources

## Version 0.6.8 
- Fixed issue that caused C2SIM Export operation errors messages not to be received
- Added `importPlanData()` method that loads additional data into an existing scenario

## Version 0.6.7 - Wed Nov 22, 2023
- Added C2SIM generation options to proxy ctor

## Version 0.6.6 - Fri Nov 17, 2023
- Added C2SIM report event propagation
- Moved C2SIM methods to proxy object (prep for adding options)

## Version 0.6.5 - Wed Nov 15, 2023
- Added C2SIM interaction support

## Version 0.6.4 - Wed Aug 1, 2023
- Added `syncScenarioSession()` method that reconciles app content with a session context 
- Returning session id on `connect()`

## Version 0.6.3 - Wed Jul 19, 2023
- Added optional sessionId parameter to `connect()`

## Version 0.6.2 - Fri Jun 16, 2023
- Added custom command events
- Removed redundant `poids` parameter from `onSymbolEdited event (is the same as `location.candidatePoids`)

## Version 0.6.1 - Wed May 31, 2023
- Added support for TO import/export
- Fixed typedoc definitions

## Version 0.6.0 - Tue May 17, 2023
- Added support for role switching

## Version 0.6.0 - Tue May 16, 2023
- Added support for scenario management

## Version 0.5.1 - Thu May 4 2023
- Added support for Task Orgs - Units and Relationships
- For symbols created from a Task Org/ORBAT, the unique id of the Task Org Unit that this symbol was created from is included as a `toUnitPoid` property


## Version 0.5.0 - Tue May 2 2023
- Added support for Tasks
- Updated package versions to remove vulnerabilities

## Version 0.4.0 - Wed Feb 17 2021
- Removed the speech code from the SDK - needs to be added via the separate [`@hyssostech/azurespeech-plugin`](https://github.com/hyssostech/sketch-thru-plan-sdk-resources/tree/main/plugins/speech) or other compatible plugin

## Version 0.3.1 - Tue Jan 26 2021
- Restricting the speech display to client that produced it
- Added `asGeoJSON()` method to stpsymbol
- Removed deprecated code that 

## Version 0.3.0 - Thu Jan 21 2021
- Added support for symbol update, deletion, n-best selection
- Strict mode compliance changes

## Version 0.2.0 - Thu Jan 21 2021
- Switched from gulp to simpler npm scripts
- Moved to rollup from browserify, added prettier
- Some refactoring and cleanup of the connector code

## Version 0.1.5 - Mon Nov 2 2020
- Improvements to documentation

## Version 0.1.4 - Mon Nov 2 2020
- Improvements to documentation

## Version 0.1.3 - Mon Nov 2 2020

- package.json cleanup
- Connector code cleanup 

## Version 0.1.2 - Thu Oct 29 2020
- Added typedoc documentation
- Hosting docs in github pages

## Version 0.1.1 - Wed Oct 28 2020
- Refactored to isolate the speech recognition bits, which can be replaced by other services
- Moved samples and quickstart to a separate resources project

## Version 0.1.0 - Tue Oct 27 2020
- Minimal support for sketch and speech collection, symbol recognition handling