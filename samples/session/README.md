# Session sample

This sample adds session connection capabilities to the  [Custom Commands](../commands) sample.

For Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).

This sample illustrates STP session capabilities:

* A single STP engine (v5.9+)  provides support for multiple sessions: edits and task interpretation are applied  
to the symbols within each session in isolation
* Roles can be set independently for each client app instance, even if the apps share a common session
* Different TO/ORBAT may be loaded independently into client app instances, even if the apps share a common session
 
### Sessions 

Sessions in STP define contexts that are isolated from each other, meaning that edits performed within a 
session do not affect any other sessions. This context consists of a single plan/scenario at a time. 
New plans may be created or loaded during a session, replacing the previous state with a blank or populated 
set of symbols and tasks. Clients that are joined to the same session receive notifications of the edits 
performed by other clients, including plan/scenario creation and loads,
and can therefore collaborate in the creation of a plan.
 
In addition, Roles can be set on an individual app instance basis. Apps, even if sharing the same 
session, can select their own individual roles, without interfering with other instances. Two browser tabs 
can for example share edits on a common session, but one of the tabs may be set for S2, and the other for S3. 
Default affiliations in each tab will be different.

Different TO/ORBAT data can also be active in each tab, representing for example friendly an hostile
organizations.
TOs that are loaded by a client are available within the shared planning scenario to all clients in
that session. 
All clients receive notifications as task org units and relationships are added during the load,
just as happens with any other type of symbol during load.
These TOs only become active when explicitly selected within app instances themselves.
At that point, the selection made by each instance can differ, so users can pick the
context they like, independently of what is selected in other instances 
(see the [TO sample](../to/README.md) for additional discussion on TOs). 

Sessions can be specified in two ways:
 
1. As a suffix to the WebSocket connection string, for example `wss://stp.hyssos.com/ws/<session id>`. 
Instances that connect using the same suffix are placed in the same session.
 
	For example, two sessions of the STP sample app can be started like so, using the querystring parm that sets the 
	STP engine endpoint url:
	* [https://stp.hyssos.com/stp-app?stpurl=wss:\stp.hyssos.com\ws\12349876](https://stp.hyssos.com/stp-app?stpurl=wss:\stp.hyssos.com\ws\12349876)
	* [https://stp.hyssos.com/stp-app?stpurl=wss:\stp.hyssos.com\ws\98761234](https://stp.hyssos.com/stp-app?stpurl=wss:\stp.hyssos.com\ws\98761234)
 
	The Ids are arbitrary sequences of letters and numbers of any length, but should be chosen to be unique to 
avoid clashes with others that may have chosen the same id.
 
1. As an additional `sessionId` parameter of the `connect()` SDK method:

 ```javascript
  /**
   * Connect and register the service, informing of the subscriptions it handles / consumes
   * @param serviceName - Name of the service that is connecting
   * @param solvables - Array of messages that this service handles
   * @param timeout - Optional number of seconds to wait for a connection before failing
   * @param machineId - Optional machine Id to use. If not provided, it is set to some unique Id.
   * @param sessionId - Optional session Id to use. If not provided:
   *  1. the suffix to the WebSocket connection string is used
   *  2. if no WebSocket suffix was provided, the machineId is used. 
   *  3. If machineId is not provided, a unique random Id is used
  */
  async connect(
    serviceName: string,
    solvables: string[],
    timeout: number = this.DEFAULT_TIMEOUT,
    machineId: string | null = null,
    sessionId: string | null = null
  ): Promise<void>;
 ```

This option is further described in the next section.
 
## Code walkthrough

See the [gmaps sample](../gmaps) for details on most of the code. 
Additional details on the baseline code extended by this sample can be found in the [custom command handling sample](../commands/README.md).


### Connecting to a session

If defining sessions during `connect`, an additional `sessionId` parameter specifies the desired Id.
If left undefined, defaults are applied, in the given order:
 
1. Explicit `sessionId` parameter provided in `connect()`
2. Suffix extracted from the WebSocket connection string
3. `machineId` `connect()` parameter 
4. `machineId`, in turn, will resolve to a random Id, if not provided.
 
NOTE: browser apps don't have direct access to machine specific parameters - see a discussion
on the last section.


```javascript
// Connection to STP and app launch
const buttonConnect = document.getElementById('connect');
buttonConnect.onclick = async () => {
    try {
        // Retrieve the session - if empty, defaults are applied by STP - 
        const sessionBox = document.getElementById('sessionId');
        let session = sessionBox.value;
        // TODO: display some sort of progress indicator/wait cursor
        // Connect and display the assigned session id on the UI
        sessionBox.value = await stpsdk.connect(appName, 10, machineId, session);
        // Load map and start edit session
        runApp(appName);
    } catch (error) {
        let msg = "Failed to connect to STP at " + webSocketUrl + 
           ". \nSymbols will not be recognized. Please reload to try again";
        log(msg, "Error", true);
        // Nothing else we can do
        return;
    }
};
```

The assigned session is returned by `connect()`. In this sample, it is displayed on the session form textbox.

### Default session as connecction string suffixes

As in [all other samples](../README.md), the STP server endpoint is defined as a parameter to a
connection plugin, more commonly the WebSocket one that is included in the SDK.

```javascript
// Create an STP connection object - using a websocket connection to STP's native pub/sub system
// TODO: get the url from an interface field so user can define the server as well as the session
const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);

// Initialize the STP recognizer with the connector definition
stpsdk = new StpSDK.StpRecognizer(stpconn);
```

As noted, suffixes to the connection string such as `webSocketUrl+'/1J3496728D'` are interpreted as session defaults. 

### Automatic joining of existing session scenario

After a successful connection, the map is loaded and a scenario is joined or created.
The actual running of the app happens as the event handlers set up in `start()`
are triggered.

```javascript
async function runApp(appName) {
    // Load the map
    map.load();

    // Join scenario if there is an active one already
    if (await stpsdk.hasActiveScenario()) {
        await stpsdk.joinScenarioSession();
        log("Joined scenario");
    }
    else {
        // Start a new scenario
        await stpsdk.createNewScenario(appName);
        log("New scenario created");
    }
}
```

### Synchronizing loaded content with a session

The `syncScenarioSession()` method updates a session so it is synchronized with loaded content.
Only the differences between the loaded content and the session result in STP update notifications
broadcast to clients of a session.

That is useful in cases where parts of a plan may have been developed offline, and are being
brought together for joint work in a collaborative session.

NOTE: since the loaded data in this sample is a const, synchronization cannot
be effectively demonstrated.
It only makes sense when loaded content (from persistent storage) may have been
evolved/modified while not connected to a particular STP instance that is
already loaded with the same session data.


```javascript
const buttonSync = document.getElementById('sync');
buttonSync.onclick = async () => {
    try {
        if (content !== '') {
            // TODO: retrieve content from persistent storage instead of 'content' variable
            // TODO: display some sort of progress indicator/wait cursor
            await stpsdk.syncScenarioSession(content, 90);
            log("Synched scenario with session");
        }
        else {
            log("No scenario data to sync - Save first");
        }
    } catch (error) {
        log(error, 'Error');
    }
};
```

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



### A note on MachineId in browser apps

`machineId` is intended to represent an Id that is shared by all apps running on a particular machine. 
The assumption is that client apps running on the same machine may provide different views of the same data that a
user is interested in at a moment. Whether this is true or not depends on specific use cases.  In .NET apps, a 
unique Id is extracted automatically by the SDK. JavaScript does not provide similar access to the hardware. 
A potential solution, in case having all apps on a machine share a session automatically makes sense,  is to inject the machine Id via some launch code that provides it to the app as a querystring 
parameter, for example in a batch file:

```shell
set QSTRING=""
rem Add a unique machine id used to represent input collected by the browser - needs to be the same as used in 
rem other apps running on the machine
rem if the ink is to be fused with an external speech recognizer running on the box
for /f "tokens=2 delims==" %%a in ('wmic os get serialnumber /format:value') do set SERIALNUMBER=%%a
rem Remove '-' that cause some parsing to fail
for /f "tokens=1-4 delims=.^-" %%i in ("%SERIALNUMBER%") do @set  MACHINEID=%%i%%j%%k%%l
rem Add to querystring if not empty - it should never be though
IF "%MACHINEID%"=="" GOTO Loop
set QSTRING="machineid=%MACHINEID%& "
```
