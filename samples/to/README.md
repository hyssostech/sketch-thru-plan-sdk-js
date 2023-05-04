# Task Org / ORBAT event handling sample

This sample adds handling of STP Task Org / ORBAT elements, extending the [tasks](../tasks) sample.

For Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).

STP has the ability to employ pre-defined ORBATs or Task Orgs (TO) defining unit organization and equipment tasked in a mission.
STP takes advantage of these definitions to provide a streamlined ability to place units by just speaking their designators.
Sketching a point and speaking 'Alpha Three One', for example, may result in n armored infantry company with designators `A/3-1` to be placed on the map, if such unit has been defined as part of a loaded TO.

A TO is defined in STP as a collection of `Task Org Units` and `Task Org Relationships` that specify a hierarchy amongst the Units.

## Code walkthrough

See the [gmaps sample](../gmaps) for details on most of the code. Here just the changes introduced in this sample - TO event handling - are described.

This sample adds simple TO event handlers, that just display a short message to users when TO Units and Relationships are added, modified, or deleted. 

An actual application would provide users with user interface elements that would let users inspect, modify, and delete, TO Units and Relationships. 

### Event handling

As seen in previous samples, it is important to subscribe to the handlers of interest before connecting to STP. This information is used by the SDK to build the corresponding subscription parameters that tell STP which events/messages to send to this client app.

This samples adds the following subscriptions:

* onTaskOrgUnitAdded - invoked whenever a new task org unit is added to STP
* onTaskOrgUnitModified - invoked whenever the properties of a task org unit are modified
* onTaskOrgUnitDeleted - invoked whenever the a task org unit is deleted/removed

* onTaskOrgRelationshipAdded - invoked whenever a new task org relationship is added to STP
* onTaskOrgelationshipModified - invoked whenever the properties of a task org relationship are modified
* onTaskOrgelationshiptDeleted - invoked whenever the a task org relationship is deleted/removed
 

```javascript
    // A new Task Org Unit has been recognized and added
    stpsdk.onTaskOrgUnitAdded = (toUnit: StpTaskOgrUnit, isUndo: boolean) => {
        try {
            // Display some properties
            log("Task Org Unit added: " + toUnit.description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a Task Org Unit were modified
    stpsdk.onTaskOrgUnitModified = (poid: string, toUnit: StpTaskOgrUnit, isUndo: boolean) => {
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
* The `toUnit` parameter provides the Task Org Unit properties, which extend StpSymbol with some TO specific properties (details below)
* The `toRelationship` parameter provides Task Org relationship properties that establish the relationship between Task Org Units.

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

### Communicating task org edits to STP

Task Org edits performed via a client interface, for example in a Task Org Editor, need to be communicated to STP, so that the internal state is consistent, and  actions performed by a client can be propagated to other clients that may be connected to the same collaboration session.

The following SDK methods are available to communicate client task edits:

```javascript
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

