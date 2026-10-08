# Task event hadling sample

This sample adds handling of STP Tasks, extending the [gmaps](../gmaps) demonstration os Sketch-Thru-Plan sketch and speech creation of military plans.

For Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).

STP automatically identifies tasks from multiple symbols, for example identifying a potential attack when a Unit, an Objective, and a Main Attack symbol starting at the Unit and ending inside the Objective are placed on the map.

When one of the symbols of an identified task are modified or deleted, STP detects the changes and modifies or removes the affected task.

![IMAGE](./task.png)

## Code walkthrough

See the [gmaps sample](../gmaps) for details on most of the code. Here just the changes introduced in this sample - task event handling - are described.

This sample adds simple task event handlers, that just display a short message to users when tasks are added, modified, or deleted. 

An actual application would provide users with user interface elements that would let users inspect, modify, delete, and confirm/approve tasks. 

### Event handling

As seen in previous samples, it is important to subscribe to the handlers of interest before connecting to STP. This information is used by the SDK to build the corresponding subscription parameters that tell STP which events/messages to send to this client app.

This samples adds the following subscriptions:

* onTaskAdded - invoked whenever a new task is created as a result of successful combination of multiple symbols
* onTaskModified - invoked whenever the properties of a task are modified
* onTaskDeleted - invoked whenever the a task is deleted/removed

 

```javascript
    // A new task has been recognized and added
    stpsdk.onTaskAdded = (poid: string, alternates: StpTask[], taskPoids: string[], isUndo: boolean) => {
        try {
            // Display some properties
            log("Task added: " + alternates[0].description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a task were modified
    stpsdk.onTaskModified = (poid: string, alternates: StpTask[], taskPoids: string[], isUndo: boolean) => {
        try {
            // Display some properties
            log("Task modified: " + poid + " " + alternates[0].description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A task was removed
    stpsdk.onTaskDeleted = (poid: string, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task removed: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
```
### Types

* The `poid` parameter provides the unique identifier assigned by STP
* The `alternates` array provides the ranked task interpretation. It is common for a generic task to contain alternates for each of the possible doctrinal variations, for example and `Attack` usually includes alternates for `Attack to Fix`, `Secure`, `Destroy` and so on
* The `taskPoids` parameter is an array of the unique identifiers of all the Tactical Graphics associated with a task, for example objective, axis of advance and other elements STP detects are part of a task.

Each of the `alternates` is an StpTask object with the following properties:

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
| roe | Task Rules of Engagement enum (`rulesOfEngagement` is a deprecated alias)
| startTime | Start time slot
| endTime | End time slot
| speech | Associated speech, if applicable
| language | Language describing the task
| taskStatus | Automatic or manual creation status: `implicit` or `explicit`
| uiStatus | Confirmation status: `confirming` or `confirmed`
| prob | Task interpretation likelihood 

`What`, `How`, and `Why` are defined by enums. Their values are the engine's enum member
names, exactly as they arrive on the wire (for example `"AMBUSH"`):

```javascript
/**
 * Task What
 */
export enum TaskWhat {
  NotSpecified = "NOT_SPECIFIED",
  AdvisePolice = "ADVISE_POLICE",
  Ambush = "AMBUSH",
  AssignResponsibility = "ASSIGN_RESPONSIBILITY",
  Block = "BLOCK",
  BombAttack = "BOMB_ATTACK",
  Breach = "BREACH",
  Bypass = "BYPASS",
  Canalize = "CANALIZE",
  Clear = "CLEAR",
  CoerciveRecruiting = "COERCIVE_RECRUITING",
  CollectCasualties = "COLLECT_CASUALTIES",
  CollectCivilians = "COLLECT_CIVILIANS",
  CollectPrisoners = "COLLECT_PRISONERS",
  ConductAmbush = "CONDUCT_AMBUSH",
  ConductAviatonAmbush = "CONDUCT_AVIATON_AMBUSH",
  ConductBilat = "CONDUCT_BILAT",
  ConductGroupEngagement = "CONDUCT_GROUP_ENGAGEMENT",
  ConductRaid = "CONDUCT_RAID",
  ConductTcpOperation = "CONDUCT_TCP_OPERATION",
  ConstituteReserve = "CONSTITUTE_RESERVE",
  Contain = "CONTAIN",
  Control = "CONTROL",
  Convoy = "CONVOY",
  Counterreconnaissance = "COUNTERRECONNAISSANCE",
  Defeat = "DEFEAT",
  Delay = "DELAY",
  DeliverLeafletPsyop = "DELIVER_LEAFLET_PSYOP",
  Demonstrate = "DEMONSTRATE",
  /** @deprecated STP-1001: civilian behaviour, not a task - no task row produces it. Kept so old values still parse; removed in the next major release. */
  Demonstrating = "DEMONSTRATING",
  Destroy = "DESTROY",
  Disengage = "DISENGAGE",
  Disrupt = "DISRUPT",
  DistributeFood = "DISTRIBUTE_FOOD",
  Emplace = "EMPLACE",
  EquipPolice = "EQUIP_POLICE",
  EscortConvoy = "ESCORT_CONVOY",
  EvacuateCasualties = "EVACUATE_CASUALTIES",
  EvacuateCivilians = "EVACUATE_CIVILIANS",
  EvacuatePrisoners = "EVACUATE_PRISONERS",
  Exfiltrate = "EXFILTRATE",
  Fix = "FIX",
  Follow = "FOLLOW",
  FollowAndAssume = "FOLLOW_AND_ASSUME",
  FollowAndSupport = "FOLLOW_AND_SUPPORT",
  Halt = "HALT",
  HarassmentFires = "HARASSMENT_FIRES",
  /** @deprecated STP-1019: misspelling of {@link TaskWhat.HarassmentFires}. Kept so values from older servers or saved data still parse; removed in the next major release. */
  HarrassmentFires = "HARRASSMENT_FIRES",
  HouseToHousePsyop = "HOUSE_TO_HOUSE_PSYOP",
  IedAttack = "IED_ATTACK",
  Interdict = "INTERDICT",
  Isolate = "ISOLATE",
  Limit = "LIMIT",
  /** @deprecated STP-1001: civilian behaviour, not a task - no task row produces it. Kept so old values still parse; removed in the next major release. */
  Looting = "LOOTING",
  MaintainHide = "MAINTAIN_HIDE",
  MaintainOutpost = "MAINTAIN_OUTPOST",
  Move = "MOVE",
  Neutralize = "NEUTRALIZE",
  Observe = "OBSERVE",
  Occupy = "OCCUPY",
  Patrol = "PATROL",
  Penetrate = "PENETRATE",
  PositionSniper = "POSITION_SNIPER",
  PriorityOfFires = "PRIORITY_OF_FIRES",
  ProvideMedicalServices = "PROVIDE_MEDICAL_SERVICES",
  ProvideService = "PROVIDE_SERVICE",
  Receive = "RECEIVE",
  Reconstruction = "RECONSTRUCTION",
  RecruitPolice = "RECRUIT_POLICE",
  Reduce = "REDUCE",
  Refuel = "REFUEL",
  RegulateTraffic = "REGULATE_TRAFFIC",
  Reinforce = "REINFORCE",
  Release = "RELEASE",
  Resupply = "RESUPPLY",
  Retain = "RETAIN",
  /** @deprecated STP-1001: civilian behaviour, not a task - no task row produces it. Kept so old values still parse; removed in the next major release. */
  Rioting = "RIOTING",
  Secure = "SECURE",
  /** @deprecated STP-1001: civilian behaviour, not a task - no task row produces it. Kept so old values still parse; removed in the next major release. */
  SeekRefuge = "SEEK_REFUGE",
  Seize = "SEIZE",
  SniperAttack = "SNIPER_ATTACK",
  Supply = "SUPPLY",
  SupplyMunitions = "SUPPLY_MUNITIONS",
  Suppress = "SUPPRESS",
  TrainPolice = "TRAIN_POLICE",
  TransferMunitions = "TRANSFER_MUNITIONS",
  TrashRemoval = "TRASH_REMOVAL",
  Turn = "TURN",
  TvRadioPsyop = "TV_RADIO_PSYOP",
  WaterDelivery = "WATER_DELIVERY",
  WillfulRecruiting = "WILLFUL_RECRUITING"
}

/**
 * Task How
 */
export enum TaskHow {
  NotSpecified = "NOT_SPECIFIED",
  AirAssault = "AIR_ASSAULT",
  AirReconnaissance = "AIR_RECONNAISSANCE",
  AreaDefense = "AREA_DEFENSE",
  Assault = "ASSAULT",
  Attack = "ATTACK",
  AttackInZone = "ATTACK_IN_ZONE",
  AttackByFire = "ATTACK_BY_FIRE",
  CerpFunding = "CERP_FUNDING",
  /** @deprecated STP-1001: an actor class, not a way of performing a task - no task row uses it. Kept so old values still parse; removed in the next major release. */
  Civilian = "CIVILIAN",
  Contracting = "CONTRACTING",
  CordonAndSearch = "CORDON_AND_SEARCH",
  Counterattack = "COUNTERATTACK",
  CounterattackByFire = "COUNTERATTACK_BY_FIRE",
  Cover = "COVER",
  Defend = "DEFEND",
  DeliverServices = "DELIVER_SERVICES",
  Guard = "GUARD",
  InformationOperations = "INFORMATION_OPERATIONS",
  /** @deprecated STP-1019: an actor class, not a way of performing a task - no task row uses it. Kept so old values still parse; removed in the next major release. */
  Insurgent = "INSURGENT",
  MobileDefense = "MOBILE_DEFENSE",
  MovingScreen = "MOVING_SCREEN",
  /** @deprecated STP-1019: an actor class, not a way of performing a task - no task row uses it. Kept so old values still parse; removed in the next major release. */
  NgoOperation = "NGO_OPERATION",
  PassageOfLines = "PASSAGE_OF_LINES",
  Screen = "SCREEN",
  SearchAndAttack = "SEARCH_AND_ATTACK",
  Security = "SECURITY",
  SecurityForceAssistance = "SECURITY_FORCE_ASSISTANCE",
  SupportByFire = "SUPPORT_BY_FIRE",
  Withdrawal = "WITHDRAWAL"
}

/**
 * Task Why
 */
export enum TaskWhy {
  Unknown = "UNKNOWN",
  Allow = "ALLOW",
  Cause = "CAUSE",
  Create = "CREATE",
  Deceive = "DECEIVE",
  Deny = "DENY",
  Divert = "DIVERT",
  Enable = "ENABLE",
  Envelop = "ENVELOP",
  Influence = "INFLUENCE",
  Open = "OPEN",
  Prevent = "PREVENT",
  Protect = "PROTECT",
  Support = "SUPPORT",
  Surprise = "SURPRISE"
}

```

### Programmatic Task manipulation - Communicating task edits to STP

Task edits performed via a client interface, for example in a Task Editor, or a Sync Matrix editor, need to be communicated to STP, so that the internal state is consistent, and  actions performed by a client can be propagated to other clients that may be connected to the same collaboration session.

The following SDK methods are available to communicate client task edits:

```javascript
  /**
   * Request that a task be added by STP. The actual addition should only happen when STP responds with TaskAdded
   * @param task Task to add
   */
  addTask(task: StpType.StpTask);

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
   * Pick an alternate as the confirmed task. The STP runtime responds with a task update notification
   * in which uiStatus is set to 'confirmed'
   * @param poid Unique identifier of the task for which an alternate is being confirmed
   * @param nBestIndex Index indicating which of the current alternates is selected for confirmation
   */
  confirmTask(poid: string, nBestIndex: number);
```
Approving/confirming a task is similar to selecting a symbol alternate. A specific interpretation is chosen for a task, e.g. `Attack Objective to Fix`. Other alternates (e.g. `to Secure`, `to Destroy`) are removed.

Upon processing these commands, STP replies with the corresponding events: `onTaskAdded`, `onTaskModified` and `onTaskDeleted` respectively.
`onTaskModified` is issued as a response to `confirmTask`, with the `uiStatus` set to 
`confirmed`.

It is advisable for clients to update the interface just in response to the events reflecting STP's change of state, so that all clients can remain consistent with the Engine's state.
In other words, rather than marking a task as confirmed as the user for example selects a checkbox, it is recommended that the task be marked only in response to STP's `onTaskModified` event indicating a `confirmed` `uiStatus`.

### STP cached state clean up

STP caches symbols across connections. That is a foundational capability to support collaboration.
Here we just force the creation of a blank scenario/plan to always start with a clean slate,
and avoid the combination of new symbols with cached content that the user is not aware of.
The [scenario sample])(../scenario) demonstrates how these cached symbols can be retrieved
and displayed when an app loads. 

```javascript
// Always create a clean scenario, otherwise new symbols may get
// combined with cached STP content the user cannot see
await stpsdk.createNewScenario(appName);
log("New scenario created");
```