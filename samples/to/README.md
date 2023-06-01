# Task Org / ORBAT event handling sample

This sample adds handling of STP Task Org / ORBAT elements, extending the [scenario](../scenario) sample.

For Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).

STP has the ability to employ pre-defined ORBATs or Task Orgs (TO) defining unit organization and equipment tasked in a mission.
STP takes advantage of these definitions to provide a streamlined ability to place units by just speaking their designators.
Sketching a point and speaking 'Alpha Three One', for example, may result in n armored infantry company with designators `A/3-1` to be placed on the map, if such unit has been defined as part of a loaded TO.

A TO is defined in STP by three elements:

1. `Task Org` objects that contain the properties of the TO, e.g. name, update timestamp
1. `Task Org Units` define units that are part of the TO
1. `Task Org Relationships` that specify a hierarchy amongst the Units. 


Capabilities illustrate by this sample include:

* Loading a TO from persistent/external storage
* Saving a TO to persistent/external storage
* Removing a TO from a scenario 
* Selecting a TO as the default for a scenario
* Handling TO switch notifications
* Handling TO, unit and relationship events
* Adding, modifying, and deleting TOs, units, and relationships

## Code walkthrough

See the [gmaps sample](../gmaps) for details on most of the code. Here just the changes introduced in this sample - TO event handling - are described.

This sample adds simple TO event handlers, that just display a short message to users when TO Units and Relationships are added, modified, or deleted. 

An actual application would provide users with user interface elements that would let users inspect, modify, and delete, TO Units and Relationships. 

### Loading a TO from persistent/external storage

The `loadTaskOrgContent(content: string, timeout?: number)` method takes a string 
formatted according to a serialized representation of STP's native
internal formats, which is similar to JSON, but with some extensions. 
The details of this particular format are outside the scope of the samples and in general
abstracted away by the SDK.

TOs can also be represented in other formats, for example \the
 [C2SIM interoperability standard](https://github.com/OpenC2SIM/OpenC2SIM.github.io) 
xml format. That is covered elsewhere in the SDK documentation.

As the TO is being loaded, STP issues entity creation events (described further down),
essentially replaying messages in the order in which users originally placed these symbols. 

For the purposes of this sample, a literal string with a simple TO is loaded. 
An actual application would retrieve that from storage instead.

```javascript
// Load a friendly Task Org
let toFriend = undefined;
const buttonFriend = document.getElementById('friend');
buttonFriend.onclick = async () => {
    try {
        // TODO: retrieve content from persistent storage instead of 'content' variable
        // TODO: display some sort of progress indicator/wait cursor
        if (toFriend === undefined)
        {
            // Not yet loaded
            let content = `object_set([
                [fsTYPE: task_org, name: '3-3 short', affiliation: friend, poid: idR47DS5VCGL9ZE, date: '2023-05-22T13:40:00Z'],
                [fsTYPE: task_org, name: '3-3 short', affiliation: friend, poid: idR47DS5VCGL9ZE, date: '2023-05-22T13:40:00Z'],
                [fsTYPE: task_org_unit, name: 'A/2-69', designator1: 'A', unit_parent: '2-69', sidc: 'SFGPUCIZ---E---', parent_poid: poid(idR47DS5VCGL9ZE), affiliation: friend, echelon: company, poid: 'uuid7e99345a-f15a-4939-b963-0b83b1ec40f0'],
                [fsTYPE: task_org_unit, name: 'PINEAPPLES | [ROYAL] PINEAPPLES', designator1: '1', unit_parent: 'A/2-69', sidc: 'SFGPUCIZ---D---', parent_poid: poid(idR47DS5VCGL9ZE), affiliation: friend, echelon: platoon, poid: 'uuid5336c5d5-9182-4846-bdd8-5c517869c274'],
                [fsTYPE: task_org_relationship, poid: idPNPMCKGE2TPLF, affiliation: friend, parent: poid(uuid7e99345a-f15a-4939-b963-0b83b1ec40f0), relationship: organic, child: poid(uuid5336c5d5-9182-4846-bdd8-5c517869c274), parent_poid: poid(idR47DS5VCGL9ZE)],
            ])`;
            let toFriend = await stpsdk.importTaskOrgContent(content);
        }
        // Set as the default
        await stpsdk.setDefaultTaskOrg(toPoid);
        log("Friendly TO loaded " + toPoid + " and set as default");
    } catch (error) {
        log(error, 'Error');
    }
};
```


### Setting TO as the default

The `setDefaultTaskOrg(poid: string, timeout?: number)` method activates a specified TO.
In this sample, loaded TO are immediately set as the default, for simplicity sake.

To switch between the friend and hostile TO as users select the respective button,
this app loads the  TO content if needed, and then sets it as the default by invoking the 
`setDefaultTaskOrg()` method reference it's unique id. 

An actual app would normally provide users other means to select a current TO, 
as further discussed below.

### Selection of the active TO

Multiple TO can be loaded into STP, but just a single one is active at each moment on a client app.
Different TO may use the same names/designators to refer to different symbols, for example a
`1/1` may refer to an Infantry Battalion in a `friendly` TO, and to a Air Defense Artillery Battalion 
in a `hostile` TO.

The active TO determines the units that are added when the user speaks a TO symbol name, 
such as designators like `A/2-69`, or TO names, like `Royal Irish`. 

In the simplest case - such as presented in this sample - the TO that was set as the default 
last is the one that is active.
In more complex scenarios, where Roles asn COAs may be set, additional flexibility is offered
to dynamically load different TOs depending on context.
For discussion of this mechanism, see:

* The [roles](../roles/) sample illustrates how the selection of a particular `role` 
affects TO selection. 
If `S2` is selected, for example, a default `hostile` affiliation is assumed. 
If there is a default hostile TO that has been previously set, that TO is automatically used.

* The [coas](../coas) sample illustrates the association of specific TOs to a Course of Action (COA).
TOs associated with a COA take precedence over the default.

### Handling TO switches

The `onTaskOrgSwitched` event is triggered by the sdk whenever user actions (e.g. loading a different TO)
cause the active TO to change.

In this sample, the name of the active TO is displayed to provide an indication of the language
that is enabled.

```javascript
    // A new TO became active
    let toPoid = undefined;
    stpsdk.onTaskOrgSwitched = (taskOrg) => {
        try {
            // Set the current TO id
            toPoid = taskOrg.poid;
            // Display new task org on the UI
            const toName = document.getElementById('toName');
            toName.innerText = taskOrg?.name ?? 'none';
            if (taskOrg?.affiliation == 'friend') {
                toName.style.color = 'blue';
            }
            else if (taskOrg?.affiliation == 'hostile') {
                toName.style.color = 'red';
            }
            else {
                toName.style.color = 'gray';
            }
            log("Task Org switched to: " + taskOrg.poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
```

### Saving a TO to persistent/external storage

The `getTaskOrgContent(poid: string, timeout?: number)` method returns the contents of a specific TO
as a string formatted according to a serialized representation of STP's native
internal formats, ready to be loaded back via `loadTaskOrgContent()`

For the purposes of this sample, the TO content is just loaded into a variable. 
An actual application would save that to storage instead.


```javascript
// Persist active TO
const buttonGetTO = document.getElementById('getto');
buttonGetTO.onclick = async () => {
    // Get TO content back, ready to persist
    try {
        if (toPoid) {
            let toContent = await stpsdk.getTaskOrgContent(toPoid);
            log("Retrieved content of latest TO (id " + toPoid + ") ready to save");
        }
        else {
            log("Nothing to retrieve. Load a TO first");
        }
    } catch (error) {
        log(error, 'Error');
    }
};
```

### Event handling

As seen in previous samples, it is important to subscribe to the handlers of interest before connecting to STP. This information is used by the SDK to build the corresponding subscription parameters that tell STP which events/messages to send to this client app.

This samples adds the following subscriptions:

* onTaskOrgAdded - invoked whenever a new task org is added to STP
* onTaskOrgModified - invoked whenever the properties of a task org are modified
* onTaskOrgDeleted - invoked whenever the a task org is deleted/removed

* onTaskOrgUnitAdded - invoked whenever a new task org unit is added to STP
* onTaskOrgUnitModified - invoked whenever the properties of a task org unit are modified
* onTaskOrgUnitDeleted - invoked whenever the a task org unit is deleted/removed

* onTaskOrgRelationshipAdded - invoked whenever a new task org relationship is added to STP
* onTaskOrgelationshipModified - invoked whenever the properties of a task org relationship are modified
* onTaskOrgelationshiptDeleted - invoked whenever the a task org relationship is deleted/removed
 
 **Task Orgs**

```javascript
    // A new Task Org Unit has been recognized and added
    stpsdk.onTaskOrgAdded = (taskOrg: StpTaskOrg, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task Org added: " + taskOrg.name, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a Task Org Unit were modified
    stpsdk.onTaskOrgModified = (poid: string, taskOrg: StpTaskOrgUnit, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task  Org modified: " + poid + " " + taskOrg.name, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A Task Org Unit was removed
    stpsdk.onTaskOrgDeleted = (poid: string, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task  Org deleted: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
```

**Task Org Units**

```javascript
    // A new Task Org Unit has been recognized and added
    stpsdk.onTaskOrgUnitAdded = (toUnit: StpTaskOrgUnit, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task Org Unit added: " + toUnit.description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a Task Org Unit were modified
    stpsdk.onTaskOrgUnitModified = (poid: string, toUnit: StpTaskOrgUnit, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task  Org Unit modified: " + poid + " " + toUnit.description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A Task Org Unit was removed
    stpsdk.onTaskOrgUnitDeleted = (poid: string, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task  Org Unit deleted: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
```
**Task Org Relationships**

```javascript
    // A new Task Org Relationship has been recognized and added
    stpsdk.onTaskOrgRelationshipAdded = (toRelationship: StpTaskOgrRelationship, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task Org Relationship added: " + toRelationship.poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a Task Org Relationship were modified
    stpsdk.onTaskOrgRelationshipModified = (poid: string, toRelationship: StpTaskOgrRelationship, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task Org Relationship modified: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A Task Org Relationship was removed
    stpsdk.onTaskOrgRelationshipDeleted = (poid: string, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task Org Relationship deleted: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
```
### Types

* The `poid` parameter provides the unique identifier assigned by STP
* The `taskOrg` parameter provides the Task Org properties (details below)
* The `toUnit` parameter provides the Task Org Unit properties, which extend StpSymbol with some TO specific properties (details below)
* The `toRelationship` parameter provides Task Org relationship properties that establish the relationship between Task Org Units.

`StpTaskOrg` objects have the following properties:


| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | task_org                                                                      |
| poid              | STP unique identifier                                                         |
| name              | Task Org name, e.g. '3-3' |
| affiliation       | 'friend' or 'hostile' |
| timestamp         | Update date   |


`StpTaskOrgUnit` objects have the following properties:


| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | task_org_unit                                 |
| unitTytpe         | Function description, such as 'MECHANIZED INFANTRY' |
| info              | Additional information |
| name              | Name used to place the unit on the map. Can be the designator, e.g. `A/3-1`, or an expression with grouping (parenthesis) alternatives (pipe symbol) and optional (square brackets).
    Example: (ONE | FIRST) [ROYAL] IRISH [GUARDS] [REGIMENT]	
    Accepts these names, amongst others:
      ONE IRISH
      FIRST IRISH
      ONE ROYAL IRISH
      FIRST ROYAL IRISH REGIMENT
      ONE ROYAL IRISH GUARDS REGIMENT |

The above properties are in addition to the `StpSymbol` properties that `StpTaskOrgUnit` extends:

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Symbol type: unit, mootw, equipment, tg, task                                 |
| poid              | STP unique identifier                                                         |
| parentCoa         | Unique id of the COA this symbol belongs to |
| sidc.partA        | Part A of the 2525D id |
| sidc.partB        | Part B of the 2525D id |
| sidc.partC        | Part C of the 2525D id |
| sidc.symbolSet    | 2525D Symbol Set |
| sidc.legacy       | 2525C SIDC |
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
| branch            | weapon, ground_unit, civilian_air, special_operations, vstol, equipment, installation, military_air, military_sea, military_submarine |


`StpTaskOrgRelationship` objects have the following properties:

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | | Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Symbol type: unit, mootw, equipment, tg, task                                 |
| parent            | Parent Task Org Unit unique id  |
| child             | Child Task Org Unit unique id |
| relationship      | Type of Relationship between child and parent |

`Relationship` is defined by an enum:

```javascript
/**
 * Command relationship
 */
export enum CommandRelationship {
  /**
  * None
  */
  None = "none",
  /**
  * Organic
  */
  Organic = "organic",
  /**
  * Attached
  */
  Attached = "attached",
  /**
  * Assigned
  */
  Assigned = "assigned",
  /**
  * ADCON
  */
  AdCon = "adcon",
  /**
  * OPCON
  */
  OpCon = "opcon",
  /**
  * TACON
  */
  TaCon = "tacon",
  /**
  * Direct Support
  */
  DirectSupport = "ds",
  /**
  * Reinforcing
  */
  Reinforcing = "r",
  /**
  * General Support Reinforcing
  */
  GeneralSupportReinforcing = "gsr",
  /**
  * General Support
  */
  GeneralSupport = "gs"
};
```

### Communicating TO edits to STP

Task Org edits performed via a client interface, for example in a Task Org Editor, need to be communicated to STP, so that the internal state is consistent, and  actions performed by a client can be propagated to other clients that may be connected to the same collaboration session.

The following SDK methods are available to communicate client task edits:

```javascript
  /**
   * Add a new TO to the scenario
   * @param taskOrg - TO to add 
   * @returns TO's unique id
   */
  addTaskOrg(taskOrg: StpType.StpTaskOrg);

  /**
   * Update TO definition
   * @param poid 
   * @param taskOrg - updated TO
   */
  updateTaskOrg(poid: string, taskOrg: StpType.StpTaskOrg);

  /**
   * Delete TO from scenario
   * @param poid 
   */
  deleteTaskOrg(poid: string);
  
  /**
   * Request that a Task Org Unit be added by STP. The actual addition should only happen when STP responds with TaskOrgUnitAdded
   * @param toUnit Task Org Unit to be added
   */
  addTaskOrgUnit(toUnit: StpType.StpTaskOrgUnit);

  /**
   * Request that a Task Org Unit be updated by STP. The actual update should only happen when STP responds with TaskOrgUnitModified
   * @param poid Unique identifier of the Task Org Unit to update
   * @param toUnit Task Org Unit to be updated
   */
  updateTaskOrgUnit(poid: string, toUnit: StpType.StpTaskOrgUnit);

  /**
   * Request a Task Org Unit deletion from STP. The actual removal should only happen when STP responds with TaskOrgUnitDeleted
   * @param poid Unique identifier of the Task Org Unit to delete
   */
  deleteTaskOrgUnit(poid: string);

  /**
   * Request that a Task Org Relationship be added by STP. The actual addition should only happen when STP responds with TaskOrgRelationshipAdded
   * @param toRelationship Task Org Relationship to be added
   */
  addTaskOrgRelationship(toUnit: StpType.StpTaskOrgRelationship);

  /**
   * Request that a Task Org Relationship be updated by STP. The actual update should only happen when STP responds with TaskOrgRelationshipModified
   * @param poid Unique identifier of the Task Org Relationship to update
   * @param toRelationship Task Org Relationship to be updated
   */
  updateTaskOrgRelationship(poid: string, toUnit: StpType.StpTaskOrgRelationship);
  /**
   * Request a Task Org Relationship deletion from STP. The actual removal should only happen when STP responds with TaskOrgRelationshipDeleted
   * @param poid Unique identifier of the Task Org Relationship to delete
   */
  deleteTaskOrgRelationship(poid: string);

```

Upon processing these commands, STP replies with the corresponding events: `onTaskOrgUnitAdded`, `onTaskOrgUnitModified`, `onTaskOrgUnitDeleted`, `onTaskOrgRelationshipAdded`, `onTaskOrgRelationshipModified` and `onTaskOrgRelationshipDeleted` respectively.

It is advisable for clients to update the interface just in response to the events reflecting STP's change of state, so that all clients can remain consistent with the Engine's state.

