# Sketch-Thru-Plan Change Log
npm config list
## Version 0.6.15

Closes the wire-surface gap with the STP engine. Everything below is additive;
no existing API changed.

- **Seventeen methods added**, matching dispatch arms the engine bridge already
  exposed: `advertiseViewport`, `changeTimeOut`, `getActiveScenarioDescription`,
  `getAllObjects`, `getDeletedObjects`, `getPoidObject`,
  `getScenarioTaskOrgList`, `getTaskOrgObjects`, `recognizeNow`, `resetRole`,
  `resetSegmentationTimeout`, `resetStpScenario`, `sendAudioCaptureState`,
  `sendListen`, `setAutoTasking`, `setSpeechListening`, `undoLastOp`
- **Three events the engine emits but this SDK could never receive** are now
  handled: `onNewScenario`, `onSpeechDiscarded`, `onSpeechParsed`. No handler
  was declared for them, so `buildSolvables()` left them out of the
  subscription set and the engine never sent them
- **`onCoaSwitched` restored.** Its dispatch arm sat inside a `/* */` block with
  invalid syntax and its property declaration was dead alongside it, despite a
  comment claiming the arm was live
- **`refreshSubscriptions()` added**, with `updateSolvables()` as an optional
  method on `IStpConnector`, so a handler attached after `connect()` is picked
  up instead of staying silently unrouted for the life of the connection
- JSON-RPC contract `json-api/sketch-thru-plan-api.json` raised to **0.4.0**:
  the 17 methods documented, transport-level messages marked `x-layer`, and the
  C2SIM `options` key set documented in place of "implementation-defined"

## Version 0.6.14 - BREAKING: symbology enum values renamed on the wire

**Breaking change.** The STP engine renamed four symbology enums so their names match the values
its symbol tables have always authored. Those names go onto the JSON wire verbatim (the bridge
serializes them with `.ToString()`), so the strings STP sends have changed. The type definitions
in `stptypes.ts` are updated to match; code comparing against the OLD strings will no longer
match, and TypeScript will now reject them.

| property | was | now |
|---|---|---|
| `affiliation` | `assumedfriend` | `assumed_friend` |
| `affiliation` | `suspected` | `suspect` |
| `echelon` | `armygroup` | `army_group` |
| `modifier` | `dummy` | `feint_dummy` |
| `modifier` | `dummy_hq` | `feint_dummy_hq` |
| `modifier` | `dummy_task_force` | `feint_dummy_task_force` |
| `modifier` | `dummytask_force_hq` | `feint_dummy_task_force_hq` (also gains the missing underscore) |

To migrate, update any string comparison or lookup keyed on the old values - e.g.
`symbol.affiliation === 'assumedfriend'` becomes `=== 'assumed_friend'`. The renames are
mechanical and one-to-one; no value was added, removed or merged.

Why: the SDK's enum member names had drifted from the vocabulary the engine's tables author, so
the same concept was spelled two ways depending on which side you asked. `feint_dummy` and
`suspect` are the doctrinal terms; the old names lost meaning.

**Also fixed, unrelated to the rename:** the `modifier` union declared `'task_force '` with a
TRAILING SPACE, so `modifier === 'task_force'` - the value STP actually sends - was a type error
and could never match. It is now `'task_force'`.

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