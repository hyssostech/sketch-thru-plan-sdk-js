# Scenario management sample

This sample adds management of STP scenarios, extending the [Roles](../roles) sample.

For Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).

STP scenarios are collections of related objects. 
A scenario consists of a friendly and a hostile Course Of Action (COA), which may be empty.
Each COA may include Symbols (units, equipment, mootwa), Tasks, and Task Org/ORBATs.


STP supports collaboration, making it possible for multiple (disparate) user interface apps connected 
to the STP Engine to provide users means to collaborate, by observing and building upon each other's
actions, as they speak and sketch to create and edit symbols and tasks. 

These data, shared via the Engine, is what is referred to as a `scenario`. 
Each instance of the Engine can handle multiple scenarios/sessions at a time. 
Users access this shared context via one or more user interface apps (such as the samples).
These apps may connect and disconnect at any time, and can be used simultaneously or at 
distinct times.

In this sample, the focus is just on the SDK capabilities for saving/loading data into a potentially shared context, 
illustrating how new scenarios can be created, how an app can retrieve the current scenario 
("joining a session"), and how scenarios can be saved and loaded  to/from persistent/external storage.
A single default session is used in this sample.
For a more detailed overview of `sessions`, and how multiple ones can be defined and
connected to, see the [Sessions sample](../session/).


Capabilities illustrate by this sample include:

* Creating a new blank scenario
* Querying STP for a scenario that is already loaded in the Engine and "joining" it
* Saving a scenario to persistent/external storage
* Loading data from persistent/external storage into a new/fresh scenario, fully replacing the previous content/context
* Synchronizing data from persistent/external storage into a current session
context, that operations potentially performed
offline by multiple apps are reconciled into a common state 

NOTE: client apps should always load a scenario, as the basis for further interaction.
This scenario can be a freshly created (blank) one, one that is loaded from persistent storage, 
or one that is loaded from the STP Engine, joining ongoing work.

## Code walkthrough

See the [gmaps sample](../gmaps) for details on most of the code. Here just the changes introduced in this sample - TO event handling - are described.

This sample adds a bare-bones interface for activating scenario operations. 
An actual application would provide users with additional capabilities for loading and saving 
data from persistent storage repositories. 

All scenario management methods return `Promises`, and need therefore to be handled via `async/await` 
or `then/catch` asynchronous code.
In this sample an `async/await` style is used.

All methods accept an optional `timeout` parameter, which sets the time in seconds after which the
operation is cancelled. 
Canceled operations cause the `Promise` to be `rejected`, triggering a `catch`, if one has been specified.
If not provided, a default of 30 seconds is used.  


### Creating new blank scenarios

The `async createNewScenario(name: string, timeout?: number)` method initializes a new scenario in STP. 
The scenario is named according to the provided `name` parameter.

Any previous loaded scenario is discarded.
As a consequence, multiple delete operations may be issued by the Engine, to clear out the context
of potentially multiple apps that may be connected to the Engine session.

NOTE: in this sample, entities that are removed, created, changed as a result of the scenario operations
are displayed on the user interface as the operations unfold. 
This is a simple approach that works well enough for small number of symbols.
For realistic, larger scenarios, the delays introduced by the piece-meal display will be normally
too noticeable.
A different design can be considered, in which progress is shown in a more economical fashion, 
with the full details becoming available after the conclusion of the operation.


```javascript
const appName = "SdkScenarioSample";
const buttonNew = document.getElementById('new');
buttonNew.onclick = async () => {
    try {
        // TODO: display some sort of progress indicator/wait cursor
        await stpsdk.createNewScenario(appName);
        log("New scenario created");
    } catch (error) {
        console.error(error);
    }
};
```

### Joining a loaded scenario 

The `async joinScenarioSession(timeout?: number)` method retrieves the current STP scenario content and gets it loaded into 
a local app.
`hasActiveScenario()` returns `true` if there is a scenario currently loaded in STP (from
a previous run of the application, or loaded by a different client app).
The app's usual Symbol and Task event handlers (e.g. `stpsdk.OnSymbolAdded`, 
`stpSdk.OnTaskAdded`) are invoked, as if the symbols had just been 
received from STP as a result of some user action on the UI.

NOTE: `joinScenarioSession` just affects the local client that is executing the call.
The replayed events are not broadcast to other clients - these will need to perform
their own joins, if desired. 
To load content in a way that all connected clients are updated, use `loadNewScenario`.

```javascript
const buttonJoin = document.getElementById('join');
buttonJoin.onclick = async () =>  {
    try {
        // TODO: display some sort of progress indicator/wait cursor
        if (await stpsdk.hasActiveScenario()) {
            await stpsdk.joinScenarioSession();
        log("Joned scenario");
        }
        else {
            log("No Active Scenario");
        }
    } catch (error) {
        console.error(error);
    }
};
```
NOTE: active scenarios may be empty. If `createNewScenario()` is invoked, for example, 
`hasActiveScenario()` will return true, even if no symbols were added yet.

### Synchronizing loaded content

The `syncScenarioSession()` method updates a session so it is synchronized with loaded content.
In contrast to `joinScenarioSession()`, which retrieves the current STP symbols and loads them
locally into an app, `syncScenarioSession()` is bidirectional, merging local content with STP's. 

Only the differences between the loaded content and the session's result in STP update notifications
broadcast to clients of a session.
That is useful in cases where parts of a plan may have been developed offline, and are being
brought together for joint work in a collaborative session.
The end result is a single consolidated state combining local ena Engine data being loaded in the STP 
Engine and all apps that are connected to the same session (see the [Session]()../session) sample for
additional discussion on session-based collaboration. 

The sample has limited capabilities to demonstrate synchronization. Whatever has been saved (using the `Save` button)
gets submitted as the synchronization data.


```javascript
const buttonSync = document.getElementById('sync');
buttonSync.onclick = async () => {
    try {
        if (content !== '') {
            // TODO: retrieve content from persistent storage instead of 'content' variable
            // TODO: display some sort of progress indicator/wait cursor
            await stpsdk.syncScenarioSession(content, 90);
            log("Synched (predefined) scenario with session");
        }
        else {
            log("No scenario data to sync - Save first");
        }
    } catch (error) {
        log(error, 'Error');
    }
};
```

Here's a suggested sequence of steps to examine synchronization capabilities. While these 
might provide some sense of the synchronization in action, 
the real value of synchronization is to consolidate edits performed independently by one or more users,
so that the session participants eventually arrive at a consolidated common plan, which is not demonstrated 
here:

- Add a few symbols to a scenario (new or existing)
- Save the content using the `Save` button - this keeps the current state cached in a variable.
- Make changes to the scenario, adding, deleting, and modifying symbols
- Select the `Sync` button - this will attempt to consolidate the new state of the scenario
with the state that was cached via `Save`


The updates are based on the following rules:

1. Objects (identified by their poids) that exist just on the loaded content and not the session are added
1. Objects that exist in both the loaded content and the session
    1. If their versions (`fsdb_version`) are the same, nothing is done
    1. Otherwise the more recent object (based on `fsdb_timestamp`) replaces the other
1. If an object is marked as deleted (STP uses an `fsdb_version==v0` to represent that) either
in the loaded content or the session, then object is deleted

Notice that these rules are lenient, and leave some space for potential conflicts.
Picking the most recent object for example is not guaranteed to result in a semantically
sound outcome. 
Deletions might remove objects meaningful to one of the versions (loaded content or the session's).  

The main expectation is that conflicts are avoided or fixed by proper division of labor,
so that users understand who "owns" objects or groups of objects and don't step on each others'
edits.

While this content should be populated into the session if missing, or ignored, if already loaded/synched,


### Saving scenarios to external/persistent storage

The `async getScenarioContent(timeout?: number)` method returns a string representation of the current STP
scenario.
The string is formatted according to a serialized representation of STP's native
internal formats, which is similar to JSON, but with some extensions. 
The details of this particular format are outside the scope of the samples and in general
abstracted away by the SDK.

Other representations can also be produced, for example in the
 [C2SIM interoperability standard](https://github.com/OpenC2SIM/OpenC2SIM.github.io) 
xml format. That is covered elsewhere in the SDK documentation.

For the purposes of this sample, the returned data is just kept in memory, 
but could of course be added to any other structure controlled by a platform to which STP is being added. 

```javascript
let content = '';
const buttonSave = document.getElementById('save');
buttonSave.onclick = async () => {
    try {
        // TODO: display some sort of progress indicator/wait cursor
        if (await stpsdk.hasActiveScenario()) {
            content = await stpsdk.getScenarioContent();
            // TODO: save content to persistent storage
            log("Saved scenario");
        }
        else {
            log("No Active Scenario");
        }
    } catch (error) {
        console.error(error);
    }
};
```

### Loading Scenarios from external/persistent storage

The `loadNewScenario(content: string, timeout?: number)` method takes the serialized content 
described in `getScenarioContent()` above and loads it into STP.

As the scenario is being loaded, STP issues the usual entity creation events,
essentially replaying messages in the order in which users originally placed these symbols. 

NOTE: Unlike `joinScenarioSession()`, the events are propagated to all clients of a session,
loading all with the same shared content.

As is the case with saving, the SDK is also able to import scenarios represented 
according to the [C2SIM interoperability standard](https://github.com/OpenC2SIM/OpenC2SIM.github.io) 
xml format. That is covered elsewhere in the SDK documentation.

For the purposes of this sample, data that has been cached by `getScenarioContent()` is just loaded 
back into STP, but could of course be retrieved
from any other structure controlled by a platform to which STP is being added. 

```javascript
const buttonLoad = document.getElementById('load');
buttonLoad.onclick = async () => {
    try {
        if (content !== '') {
            // TODO: retrieve content from persistent storage instead of 'content' variable
            // TODO: display some sort of progress indicator/wait cursor
            await stpsdk.loadNewScenario(content);
            log("Loaded scenario");
        }
        else {
            log("No scenario data to load - Save first");
        }
    } catch (error) {
        console.error(error);
    }
};
```

For testing purposes the suggestion is to use the following sequence of steps:

1. Create a new scenario and add a few symbols
1. Save the content (into the in memory cache)
1. Create a new scenario to remove existing symbols
1. Load the content (from the in memory cache) to verify that the previous symbols are reloaded

### Ascertaining that a valid scenario is available after connecting

As previously mentioned, client apps should start by establishing a proper context by:

* Loading a scenario from persistent storage
* Joining an existing scenario already loaded into the STP Engine, or 
* Creating a new (blank) scenario

The following snippet shows a simple approach, which creates a blank scenario if no
active one is found, or let users decide if they want to join or synch if one exists.

This snippet assumes that this is the last action performed on start(), after all
the event handlers have been setup, connection to STP was achieved, and the map
has been loaded (so symbols from a joined scenario can have a surface in place
for display).

```javascript
    // Load the map
    map.load();

    // Create new scenario if there is no active one already
    if (! await stpsdk.hasActiveScenario()) {
        // Start a new scenario
        log("STP session has no active scenario - creating new");
        await stpsdk.createNewScenario(appName);
        log("New scenario created");
    }
    else {
        // Inform user that a scenario exists
        log("STP session has active scenario - Join or Sync to display content");
    }
}
```
NOTE: `hasActiveScenario` looks for a "planning_scenario" object, which is what is added by `createNewScenario`, or loaded in `loadNewScenario()`.

If an app does not invoke `createNewScenario`, this element will _not_ be available, 
and `hasActiveScenario` will return _false_, even if objects have been added to STP.

If in doubt about the existence of the "planning_scenario" object, use an alternative (and more resource intensive) approach of attempting to retrieve
the content via `getScenarioContent()` and joining if the result is not null/empty.