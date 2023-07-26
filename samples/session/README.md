# Session sample

This sample adds session connection to the  [Custom Commands](../commands) sample.

For Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).

* Single STP engine provides support for multiple sessions: edits and task interpretation are restricted 
to the symbols within each session
* Roles can be set independently for each client app instance, even if the apps share a common session
* Different TO/ORBAT may be loaded independently into client app instances
 
### Sessions 

Sessions in STP define contexts that are isolated from each other, meaning that edits performed within a 
session do not affect any other sessions. This context consists of a single plan/scenario at a time. 
New plans may be created or loaded during a session, replacing the previous state with a blank or populated 
set of symbols and tasks. Clients that are joined to the same session receive notifications of the edits 
performed by other clients, including plan/scenario creation and loads.
 
In addition, in v5.9 Roles can be set on an individual app instance basis. Apps, even if sharing the same 
session, can select their own individual roles, without interfering with other instances. Two browser tabs 
can for example share edits on a common session, but one of the tabs may be set for S2, and the other for S3. 
Default affiliations in each tab will be different.
Different TO/ORBAT data can also be loaded into each tab, representing for example friendly an hotile
organizations (see the [TO sample](../to/README.md) for additional discussion). 

Sessions can be specified in two ways:
 
1. As a suffix to the WebSocket connection string, for example `wss://stp.hyssos.com/ws/<session id>`. 
Instances that connect using the same suffix are placed in the same session.
 
	For example, two sessions of the sample app can be started like so, using the querystring parm that sets the 
	STP engine endpoint url:
	* [https://stp.hyssos.com/stp-app?stpurl=wss:\stp.hyssos.com\ws\12349876](https://stp.hyssos.com/stp-app?stpurl=wss:\stp.hyssos.com\ws\12349876)
	* [https://stp.hyssos.com/stp-app?stpurl=wss:\stp.hyssos.com\ws\98761234](https://stp.hyssos.com/stp-app?stpurl=wss:\stp.hyssos.com\ws\98761234)
 
	The Ids are arbitrary sequences of letters and numbers of any length, but should be chosen to be unique to 
avoid clashes with others that may have chosen the same id.
 
1. As an additional parameter to the `connect()` SDK method:

 ```javascript
  /**
   * Connect and register the service, informing of the subscriptions it handles / consumes
   * @param serviceName - Name of the service that is connecting
   * @param solvables - Array of messages that this service handles
   * @param timeout - Optional number of seconds to wait for a connection before failing
   * @param machineId - Optional machine Id to use. If not provided, it is set to some unique Id.
   * @param sessionId - Optional session Id to use. If not provided:
   *  1. the suffix to the WebSocket connection string is used
   *  2. if no WebSocket suffix was provided, the machineId is used.   */
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

If defining sessions during `connect`, an additional parameter specifies the desired Id.

```javascript
// Connection to STP and app launch
const buttonConnect = document.getElementById('connect');
buttonConnect.onclick = async () => {
    try {
        // Retrieve the session - if empty, defaults are applied by STP - 
        const sessionBox = document.getElementById('sessionId');
        let session = sessionBox.value;
        // TODO: display some sort of progress indicator/wait cursor
        await stpsdk.connect(appName, 10, machineId, session);
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

As in [all other samples](../README.md), the STP server endpoint is defined as a parameter to a
connection plugin, more commonly the WebSocket one that is included in the SDK.

```javascript
// Create an STP connection object - using a websocket connection to STP's native pub/sub system
// TODO: get the url from an interface field so user can define the server as well as the session
const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);

// Initialize the STP recognizer with the connector definition
stpsdk = new StpSDK.StpRecognizer(stpconn);
```

Sessions are established by the following, in order:
 
1. Explicit `sessionId` parameter provided in `connect()`
2. Suffix extracted from the WebSocket connection string
3. `machineId` `connect()` parameter
4. `machineId`, in turn, will resolve to a random number, if not provided.
 
Notice that `machineId` is intended to represent an Id that is shared by all apps running on a particular machine. 
The assumption is that client apps running on the same machine may provide different views of the same data that a
user is interested in at a moment. Whether this is true or not depends on specific use cases.  In .NET apps, a 
unique Id is extracted automatically by the SDK. JavaScript does not provide similar access to the hardware. 
A potential solution is to inject the machine Id via some launch code that provides it to the app as a querystring 
parameter, for example in a batch file:

```
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

After a successful connection, the map is loaded and a scenario is joined or created.
The actual running of the app happens as the event handlers set up in `start()`
are triggered.

```javascript
async function runApp(appName) {
    // Load the map
    map.load();

    // Create new scenario or join ongoing one
    if (await stpsdk.hasActiveScenario()) {
        if (confirm("Select Ok to join existing scenario or Cancel to create a new one")) {
            await stpsdk.joinScenarioSession();
            log("Joined scenario");
            return;
        }
    }
    // Start a new scenario
    await stpsdk.createNewScenario(appName);
    log("New scenario created");
}
```