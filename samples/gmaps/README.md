# Adding military symbols to Google Maps via Speech and Sketch

This sample extends the [quickstart](../../qs/js) demonstration os Sketch-Thru-Plan sketch and speech creation of military plans, replacing the generic placeholder rendering with standard 2525 symbology.

## Prerequisites
* Sketch-thru-Plan (STP) Engine (v5.8.4+) running on an accessible server
* A Google Maps [API key](https://developers.google.com/maps/documentation/javascript/get-api-key)
* A subscription key for Microsoft's Azure [Speech service](https://docs.microsoft.com/azure/cognitive-services/speech-service/get-started)
* A PC or Mac with a working microphone

## Script external references

Three cdn libraries are referenced in [`index.html`](index.html):

1. Microsoft's Cognitive Services Speech SDK - used by the speech plugin
1. STP SDK itself - available on `jsdelivr`: [https://www.jsdelivr.com/package/npm/sketch-thru-plan-sdk]
1. The speech plugin

```html
    <!-- Speech recognition -->
    <script type="application/javascript" src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js"></script>
    <!-- STP SDK and plugins - needs to be added *after* the references to speech and communication services it may use -->
    <script type="application/javascript" src="https://cdn.jsdelivr.net/npm/sketch-thru-plan-sdk@0.3.1/dist/sketch-thru-plan-sdk-bundle-min.js"></script>
    <script type="application/javascript" src="https://cdn.jsdelivr.net/npm/@hyssostech/azurespeech-plugin@0.2.0/dist/stpazurespeech-bundle-min.js"></script>
```

## Configuration

Enter servers and keys by editing `index.js`. 

* Enter the server address and port where the STP websockets service is running. Make sure the port is *not* blocked by a firewall

```javascript
const webSocketUrl  = "ws://<STP server>:<STP port>";
```

* Replace the Google Maps API placeholders with your own key

```javascript
const googleMapsKey = "<Enter your Google Maps API key here>";
```

* Replace the Azure Speech placeholders with your own 

```javascript
const azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
const azureServiceRegion = "<Enter Azure's subscription region>"; 
const azureLanguage = "en-US";
```

* Optionally pick a different location and zoom level as the default

```javascript
const mapCenter = {lat: 58.967774948, lng: 11.196062412};
const zoomLevel = 13;  
```

**NOTE**: these parameters can be provided as querystring parameters as well/instead, as described next.

## Run the `index.html` sample
1. Load the page on a browser. You may need to serve the page from a proper http location (rather than file:) to avoid browser restrictions. Optional querystring parameters - can be used in addition/instead of default editing as describe in the previous section:
    * `mapkey` - Google Maps API key
    * `lat`, `lon` - coordinates of the center of the map (decimal degrees)
    * `zoom` - initial map zoom level
    * `azkey` - MS Cognitive Services Speech API key
    * `azregion` - MS Cognitive Services Speech instance region
    * `azlang` - MS Cognitive Services Speech language (default is en-US)
    * `azendp` - Optional MS Cognitive Services Speech custom language model endpoint
    * `stpurl` - STP Websockets URL

The following optional parameters can be used to configure the sample to operate alongside with a local speech recognizer, usually running on the same machine as the browser
    * `inkonly` - Prevents browser speech recognition - just the ink strokes are sent by the browser app to STP
    * `machineid` - Must be set to the same machine id (computer name) as the local speech recognizer - STP only fuses sketches to speech originated at the same computer, to avoid mix ups between actions performed by different users collaborating from different machines. Each browser tab usually has a unique Id that is used to tag both the ink and the speech that is collected. This parameter makes it possible to change that so it matches the id of a local speech recognizer, which typically employs the computer name as the tag.    


1. A connection to the STP server is established and Google Maps is displayed. If an error message is displayed, verify that STP is running on the server at the address and port configured above, and that the port is not being blocked by a firewall
1. Enter symbols by sketching and speaking, for example:
    * Sketch a point (or small line) and speak "Infantry Company", or "Recon Platoon", or "Stryker Brigade"
    * Sketch a line and speak "Phase Line Blue", or "Company Boundary", or "Main Attack Boston"
    * Sketch an area and speak "Objective Bravo" or "Assembly Area"
1. **NOTE**: Authorization for access to the microphone is displayed when speech recognition is activated
    * In Chrome, the authorization popup is shown repeatedly unless the page is served as SSL-enabled `https`. For quick testing, complete the sketching, approve access and speak. Notice as well that Chrome crashes if run from Visual Studio Code in debug mode when the speech recognition is activated
    * Firefox provides a checkbox to avoid the need for repeated authorization, so authorization needs to be provided a single time
1. Successful recognition of the symbol results in generic blue rectangles (for friendly) or red lozenges (enemy) to be displayed, with Tactical Graphics displayed in black
1. To pan and zoom, hold the `Ctrl` key while dragging the mouse


## Code walkthrough

See the [quickstart](../../quickstart) for details on most of the code. Changes introduced in this sample are concentrated on 1) task even handling, 2) the speech strategy and 3) rendering 

### Task event handling

This sample adds simple task event handlers, that just display a short message to users when tasks are added, modified, or deleted. 


```javascript
    // A new task has been recognized and added
    stpsdk.onTaskAdded = (poid, alternates, taskPoids, isUndo) => {
        try {
            // Display some properties
            log("Task added: " + alternates[0].description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a task were modified
    stpsdk.onTaskModified = (poid, alternates, taskPoids, isUndo) => {
        try {
            // Display some properties
            log("Task modified: " + poid + " " + alternates[0].description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A task was removed
    stpsdk.onTaskDeleted = (poid, isUndo) => {
        try {
            // Display some properties
            log("Task removed: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
```


| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | task                                 |
| poid              | STP unique identifier                                                         |
| parentCoa         | Unique id of the COA this task belongs to |
| creatorRole       | Role that created the task: S2, S3, S4, Eng, FSO |
| interval          | Task creation time interval |
| confidence        | Confidence score of the recognition (1.0 is 100%) |
| alt               | Rank of this task interpretation amongst the interpretation hypothesis| 
| description | Task description
| who | Unique id of the unit executing the task
| supported |   Unique id of the supported unit, if applicable
| tgs | Task's Tactical Graphics unique ids
| name | Task name, such as `AssaultObjectiveOnAxis`
| how | Task How enum
| what | Task What enum
| why | Task Why enum
| startTime | Start time slot
| endTime | End time slot
| speech | Associated speech, if applicable
| language | Language describing the task
| taskStatus | Automatic or manual creation status: `implicit` or `explicit`
| uiStatus | Confirmation status: `confirming` or `confirmed`
| prob | Task interpretation likelihood 

`What`, `How`, and `Why` are defined by enums:

```javascript
/**
 * Task What
 */
export enum TaskWhat {
  NotSpecified = "not_specified",
  AdvisePolice = "advise_police",
  Ambush = "ambush",
  AssignResponsibility = "assign_responsibility",
  Block = "block",
  BombAttack = "bomb_attack",
  Breach = "breach",
  Bypass = "bypass",
  Clear = "clear",
  CoerciveRecruiting = "coercive_recruiting",
  CollectCasualties = "collect_casualties",
  CollectCivilians = "collect_civilians",
  CollectPrisoners = "collect_prisoners",
  ConductAmbush = "conduct_ambush",
  ConductAviatonAmbush = "conduct_aviaton_ambush",
  ConductBilat = "conduct_bilat",
  ConductGroupEngagement = "conduct_group_engagement",
  ConductRaid = "conduct_raid",
  ConductTcpOperation = "conduct_tcp_operation",
  ConstituteReserve = "constitute_reserve",
  Convoy = "convoy",
  Defeat = "defeat",
  Delay = "delay",
  DeliverLeafletPsyop = "deliver_leaflet_psyop",
  Demonstrate = "demonstrate",
  Destroy = "destroy",
  Disrupt = "disrupt",
  DistributeFood = "distribute_food",
  Emplace = "emplace",
  EquipPolice = "equip_police",
  EscortConvoy = "escort_convoy",
  EvacuateCasualties = "evacuate_casualties",
  EvacuateCivilians = "evacuate_civilians",
  EvacuatePrisoners = "evacuate_prisoners",
  Fix = "fix",
  Follow = "follow",
  FollowAndAssume = "follow_and_assume",
  FollowAndSupport = "follow_and_support",
  Halt = "halt",
  HarrassmentFires = "harrassment_fires",
  HouseToHousePsyop = "house_to_house_psyop",
  IedAttack = "ied_attack",
  Limit = "limit",
  Looting = "looting",
  MaintainHide = "maintain_hide",
  MaintainOutpost = "maintain_outpost",
  Move = "move",
  Neutralize = "neutralize",
  Observe = "observe",
  Occupy = "occupy",
  Patrol = "patrol",
  Penetrate = "penetrate",
  PositionSniper = "position_sniper",
  PriorityOfFires = "priority_of_fires",
  ProvideMedicalServices = "provide_medical_services",
  ProvideService = "provide_service",
  Receive = "receive",
  Reconstruction = "reconstruction",
  RecruitPolice = "recruit_police",
  Refuel = "refuel",
  RegulateTraffic = "regulate_traffic",
  Reinforce = "reinforce",
  Release = "release",
  Resupply = "resupply",
  Retain = "retain",
  Rioting = "rioting",
  Secure = "secure",
  SeekRefuge = "seek_refuge",
  Seize = "seize",
  SniperAttack = "sniper_attack",
  Supply = "supply",
  SupplyMunitions = "supply_munitions",
  TrainPolice = "train_police",
  TransferMunitions = "transfer_munitions",
  TrashRemoval = "trash_removal",
  Turn = "turn",
  TvRadioPsyop = "tv_radio_psyop",
  WaterDelivery = "water_delivery",
  WillfulRecruiting = "willful_recruiting"
}

/**
 * Task How
 */
export enum TaskHow {
  NotSpecified = "not_specified",
  AirAssault = "air_assault",
  AirReconnaissance = "air_reconnaissance",
  AreaDefense = "area_defense",
  Assault = "assault",
  Attack = "attack",
  AttackInZone = "attack_in_zone",
  AttackByFire = "attack_by_fire",
  CerpFunding = "cerp_funding",
  Civilian = "civilian",
  Contracting = "contracting",
  CordonAndSearch = "cordon_and_search",
  Counterattack = "counterattack",
  CounterattackByFire = "counterattack_by_fire",
  Cover = "cover",
  Defend = "defend",
  DeliverServices = "deliver_services",
  Guard = "guard",
  InformationOperations = "information_operations",
  Insurgent = "insurgent",
  MobileDefense = "mobile_defense",
  MovingScreen = "moving_screen",
  NgoOperation = "ngo_operation",
  PassageOfLines = "passage_of_lines",
  Screen = "screen",
  SearchAndAttack = "search_and_attack",
  Security = "security",
  SecurityForceAssistance = "security_force_assistance",
  SupportByFire = "support_by_fire",
  Withdrawal = "withdrawal"
}

/**
 * Task Why
 */
export enum TaskWhy {
  Unknown = "unknown",
  Allow = "allow",
  Cause = "cause",
  Create = "create",
  Deceive = "deceive",
  Deny = "deny",
  Divert = "divert",
  Enable = "enable",
  Envelop = "envelop",
  Influence = "influence",
  Open = "open",
  Prevent = "prevent",
  Protect = "protect",
  Support = "support",
  Surprise = "surprise"
}

```

An actual application would provide users with user interface elements that would let users inspect, modify, delete, and confirm/approve tasks. 
Approving/confirming a task is similar to selecting a symbol alternate. A specific interpretation is chosen for a task, e.g. `Attack Objective to Fix`. Other alternates (e.g. `to Secure`, `to Destroy`) are removed.

Task edits need to be communicated to STP, so that the internal state is consistent, and  actions performed by a client can be propagated to other clients that may be connected to the same collaboration session.

The following SDK methods are available to communicate client task edits:

```javascript
  /**
   * Request that a task be added by STP. The actual addition should only happen when STP responds with TaskAdded
   * @param task Task to add
   */
  addTask(task: StpType.StpTask) {
    this.informStp('AddTask', {
      task: arguments[0]
    });
  }

  /**
   * Request that a task be updated by STP. The actual update should only happen when STP responds with TaskModified
   * @param poid Unique identifier of the task to update
   * @param alternates Alternates of the task to update - normally only one of the alternates will have been modified 
   */
  updateTask(poid: string, alternates: StpType.StpTask[]);

  /**
   * Request a task deletion from STP. The actual removal should only happen when STP responds with TaskDeleted
   * @param poid Unique identifier of the task to delete
   */
  deleteTask(poid: string);

  /**
   * Pick an alternate as the confirmedtask. The STP runtime responds with a task update notification
   * in which uiStatus is set to 'confirmed'
   * @param poid Unique identifie of the task for which an alternate is being confirmed
   * @param nBestIndex Index indicating which of the current alternates is selected for confirmation
   */
  confirmTask(poid: string, nBestIndex: number);
```

Upon processing these commands, STP replies with the corresponding events: `onTaskAdded`, `onTaskModified` and `onTaskDeleted` respectivelly.
`onTaskModified` is issued as a response to `confirmTask`, with the `uiStatus` set to 
`confirmed`.

It is advisable for clients to update the interface just in response to the events reflecting STP's change of state, so that all clients can remain consistent with the Engine's state.
In other words, rather than marking a task as confirmed as the user for example selects a checkbox, it is recommended that the task be marked only in response to STP's `onTaskModified` event indicating a `confirmed` `uiStatus`.

### Speech

This sample utilizes a "while sketching" speech approach. Recognition is enabled at the beginning of a user sketch, is kept active throughout sketching, and is deactivated 5 seconds after the sketch ends. That allows for the user to speak at any point from the start until a bit after the end of the sketching action. This approach makes it possible for long/detailed sketches, for example a long route along complex terrain to be entered and still give the user the opportunity to speak what the sketch represents (e.g. a "Main Supply Route").

To use the speech recognition plugin, start by creating a recognizer object, passing in the required keys. 

```javascript
// Create speech recognizer and subscribe to recognition events
const speechreco = new StpAS.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint);
```
Once the object is available, subscribe to the events through which the plugin communicates results/status:

* `onRecognized` - invoked when a full phrase has been recognized, or nothing was spoken (in which case null is returned)
* `onRecognizing` - optional event that returns partial interpretation results. Useful to provide feedback on longer phrases
* `onError` - recognition failure

```javascript
speechreco.onRecognized = (recoResult) => {
    if (recoResult && recoResult.results && recoResult.results.length > 0) {
        // Stop further recognition now that we have candidates
        speechreco.stopRecognizing();
        // Send recognized speech over to STP
        stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
        // Display the hypotheses to the user
        let concat = recoResult.results.map((item) => item.text).join(' | ');
        log(concat);
    }
}
// Display the recognition as it evolves
speechreco.onRecognizing = (snippet) => {
    log(snippet);
}
// Error recognizing
speechreco.onError = (e) => {
    log("Failed to process speech: " + e.message);
}
```

To activate speech recognition, `startRecognizing()` needs to be called. This is done inside the handler invoked on a map pen/mouse down:

```javascript
// Notify STP of the start of a stroke and activate speech recognition
map.onStrokeStart = (location, timestamp) => {
    // Notify STP that a new stroke is starting
    stpsdk.sendPenDown(location, timestamp);

    // Activate speech recognition (asynchronously)
    speechreco.startRecognizing();
}
```

Speech recognition is then deactivated when the stroke is completed (map pen/mouse up). Notice the timeout parameter, set to 5000. That lets the user speak for 5 more seconds after the completion of the sketch.

Note as well that in the sample `stopRecognizing()` is also called inside the `speechreco.onRecognized` handler shown previously. That avoids the interpretation of multiple phrases for the same sketch. STP only integrates single pairs of sketch and speech. 

```javascript
// Notify STP of a full stroke
map.onStrokeCompleted = (pixelBoundsWindow,topLeftGeoMap,bottomRightGeoMap,strokePoints,timeStrokeStart,timeStrokeEnd,intersectedPoids) => {
    // Notify STP of the new ink stroke
    stpsdk.sendInk(pixelBoundsWindow,topLeftGeoMap,bottomRightGeoMap,strokePoints,timeStrokeStart,timeStrokeEnd,intersectedPoids);
    // Stop speech recognition after 5 seconds
    speechreco.stopRecognizing(5000);
}
```

### Rendering

The general strategy used  within [`jmsrenderer.js`](jmsrenderer.js) is to enhance the basic GeoJSON representation of each symbol (returned by `symbol.asGeoJSON()`) with renderings produced by two renderers

* [milsymbol](https://github.com/spatialillusions/milsymbol) is used to generate SVG icons representing single point symbols (units, equipment, mootw and single point tactical graphics)
* [mil-sym-js](https://github.com/missioncommand/mil-sym-js) is used to generate GeoJSON representations of multipoint tactical graphics


The BasicRenderer used in the quickstarts is replaced in [`index.js'](index.js) by a reference to the JmsRenderer:

```javascript
    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
    // A new symbol has been recognized and added
    stpsdk.onSymbolAdded = (alternates: StpSymbol[], isUndo: boolean) => {
        // Add the best recognition to the map - better if alternates were displayed, could be chosen
        let gj = new JmsRenderer(alternates[0]).asGeoJSON();
        map.addFeature(gj);
    };
    // The properties of a symbol were modified
    stpsdk.onSymbolModified = (poid: string, symbol: StpSymbol, isUndo: boolean) => {
        // Remove current verion
        map.removeFeature(poid);
        // Add the modified symbol
        let gj = new JmsRenderer(symbol).asGeoJSON();
        map.addFeature(gj);
    };
```

The references to these renderers are included in [index.html](index.html). A local `mil-sym-js.js` file contains a (renamed) copy of the code generated by using a `ant concat savm-bc` command in the mil-sym-js project.

```html
    <script src="https://cdn.jsdelivr.net/npm/milsymbol@2.0.0/dist/milsymbol.min.js"></script>
    <script type="application/javascript" src="mil-sym-js.js"></script>
```

If using a different renderer, STP makes the following properties available by default by default (but additional ones can be defined). These need to be mapped to specific parameters of the chosen renderer.

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Symbol type: unit, mootw, equipment, tg, task                                 |
| poid              | STP unique identifier                                                         |
| parentCoa         | Unique id of the COA this symbol belongs to |
| creatorRole       | Role that created the symbol: S2, S3, S4, Eng, FSO |
| interval          | Symbol creation time interval |
| confidence        | Confidence score of the recognition (1.0 is 100%) |
| alt               | Rank of this symbol interpretation amongst the interpretation hypothesis
| sidc.partA        | Part A of the 2525D id |
| sidc.partB        | Part B of the 2525D id |
| sidc.partC        | Part C of the 2525D id |
| sidc.symbolSet    | 2525D Symbol Set |
| sidc.legacy       | 2525C SIDC |
| location          | Location of the symbol (see sub-properties below) |
| shortDescription  | Just the essential distinguishing elements, e.g. designators |
| description       | Name/type of the symbol plus designators, but may omit "friendly", "present" and other assumed decorators |
| fullDescription   | Complete description, including affiliation, status and all decorators |
| affiliation       | pending, unknown, assumedfriend, friend, neutral, suspected, hostile |
| echelon           | none, team, squad, section, platoon, company, battalion, regiment, brigade, division, corps, army, armygroup, region, command |
| parent            | Parent unit designator |
| designator1       | Main symbol designator |
| designator2       | Additional designator, e.g. in a company boundary, indicating the designator of the company to the S or E |
| status            | present, anticipated |
| modifier          | HQ and Task Force modifier: none, dummy, hq, dummy_hq, task_force, dummy_task_force, task_force_hq, dummytask_force_hq |
| strength          | none, reduced, reinforced, reduced_reinforced |
| timeFrom          | Start time, e.g. of a Restricted Operations Zone |
| timeTo            | End time, e.g. of a Restricted Operations Zone |
| altitude          | Altitude parameter, if applicable |
| minAltitude       | Symbol minimal altitude if a range is supported |
| maxAltitude       | Symbol maximal altitude if a range is supported |


### Location properties:

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Location type: point,line, area |
| width             | Location width, if applicable |
| shpae             | Gesture type, normally point, line or area. Other types include straightline, arrowthin, arrowfat, hook, ubend, ubendthreepoints, vee, opencircle, multipoint see "STP Military Symbol Gestures" documentation for details (available from Hyssos Tech upon request) |
| radius            | Radius of the area containing the symbol, if applicable (zero for point locations) |
| coords            | Array of { lat: latitude, lon: longitude } |
| centroid          | Corrdinates of the location centroid { lat: latitude, lon: longitude } |
| candidatePoids    | Unique Ids of the symbols intersected by "coords". Used for editing operations that use sketches to select objects, for example "move this", "delete this" |
