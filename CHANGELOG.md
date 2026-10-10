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