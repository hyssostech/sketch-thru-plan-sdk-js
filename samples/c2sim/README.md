# C2SIM sample

This sample adds custom command handling to the  [Custom Cmmands](../commands) sample. 

For general STP Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).

This sample requires an STP server deployment that includes a C2SIM Connector component, properly configured to interact with a C2SIM Server. 
Contact Hyssos for details on how to configure this environment.

Command and Control Systems to Simulation Systems Interoperation (C2SIM) is defined in SISO-STD-019-2020 as a standard for expressing and exchanging Command and Control (C2) information among C2 systems, simulation systems, and robotic and autonomous (RAS) systems in a coalition context.

For a comprehensive C2SIM description, see the [C2SIM Overview](https://github.com/hyssostech/OpenC2SIM.github.io/blob/master/Reference/C2SIM-Overview1.pdf). For additional details see the official [OpenC2SIM github](https://github.com/OpenC2SIM/OpenC2SIM.github.io) repo, or [Hyssos' fork](https://github.com/hyssostech/OpenC2SIM.github.io), with some additional documentation.

In short, C2SIM provides a standardized representation of 
1. Plan Initialization - the initial state of entities in a
scenario, for example Units, Equipment, Mootw entities; 
1. Plan Orders - tasking of entities contained in the initialization, for example directing a Unit to attack an Objective;
1. Reports - entity updates that may result from a Simulation/C2 system's changes to location and status as 
a result of simulated order execution.

Capabilities illustrated by this sample include:

* Exporting the current scenario to C2 and Simulators connected to a C2SIM server
* Importing Initialization data from a C2SIM server into the current scenario
* Handling Report events with entity updates

These higher level capabilities are implemented as compositions of lower-level services also exposed by the SDK:

* Retrieving C2SIM-compliant representations of the current scenario
* Pushing C2SIM-compliant content to a C2SIM server
* Pulling/retrieving Initialization content from a C2SIM server
* Converting C2SIM-compliant content to native STP format

## Code walkthrough

See the [gmaps sample](../gmaps) for details on most of the code. Here just the changes introduced in this sample - custom command handling - are described.

### Creating a proxy to interact with C2SIM

All interaction with C2SIM is conducted via a proxy, created by the SDK's  `createC2SIMProxy()`
factory method.

```javascript
// Get a proxy to interact with C2SIM
const c2simProxy = stpsdk.createC2SIMProxy();
```

The proxy constructor takes an optional `StpC2SIMOptions` object, which can be used to 
override the STP C2SIM Connector defaults, for example: 

```javascript
const c2simProxy = stpsdk.createC2SIMProxy({
  restUrl: 'http://mydomain.com:8080/C2SIMServer',
  stompUrl: 'http://mydomain.com:61613/topic/C2SIMS',
  systemName: 'MySystemName'
});
```

Default parameters are used for the options that are not explicitly overridden. 
These may vary depending on the STP Engine instance configuration (discuss with the
system's administrator).

The options available are the following:

```javascript
/** 
 * C2SIM generation options
*/
export class StpC2SIMOptions {
    /**
     * Full C2SIM server endpoint, including host:port/path, e.g. "http://10.2.10.30:8080/C2SIMServer</param>
     */
    restUrl: string | undefined;

    /**
     * C2SIM REST endpoint password
     */
    restPassword: string | undefined;

    /**
     * Full STOMP service endpoint, including host:port/destination, e.g. "http://10.2.10.30:61613/topic/C2SIM"</param>
     */
    stompUrl: string | undefined;

    /**
     * Server protocol version: "1.0.0", "1.0.1", "1.0.2"
     */
    serverProtocol: string | undefined;

    /**
     * value of the <SystemEntityList>/<SystemName> element included in the C2SIM Initialization document
     */
    systemName: string | undefined;

    /**
     * Force a C2SIM server state transition to Uninitialized before pushing Initialization.
     * Used to clear up the state to clear previous initializations - if not used, Initialization 
     * may be merged with previous ones
     */
    resetBeforeInitialize: boolean | undefined;

    /**
     * Force a C2SIM server state transition to Running right after pushing Initialization
     * This is just required if interfaces that can only be started after the Initialization is shared are used
     * One example is the VRF interface 2.16
     */
    runAfterInitialize: boolean | undefined;

    /**
     * Include the full TO (and all TG) in the Initialization and Order document. If false, just the elements that are placed in the map (and their subordinates) are included 
     */
    fullTO: boolean | undefined;

    /**
     * Use the older version of the C2SIM schema - v1.0.0 - for compatibility with existing tooling
     */
    schemaVersion: string | undefined;

    /**
     * Add TGs that are not included in any Task as MapGraphicID elements in the Initialization document
     */
    addOrphanTgToInitialization: boolean | undefined;

    /**
     * Place Task TGs  MapGraphicID elements in the Initialization documents, rather than the Orders
     */
    placeAllTgInInitialization: boolean | undefined;

    /**
     * Place Task TGs  MapGraphicID elements in the Initialization documents, rather than the Orders
     */
    includeMapGraphicId: boolean | undefined;

    /**
     * Maximum number of character for generate entitiy names - VRF Interface restriction - 0 for none 
     */
    entityNameCharLimit: number | undefined;

    /**
     * Rules of Engagement 
     */
    rulesOfEngagement: 'ROEHold' | 'ROEFree' | 'ROETight' | undefined;
    
    /**
     * Amount of minutes each STP phase takes
     */
    updateUnitPositions: boolean | undefined;

    /**
     * Folder to write export json file to.
     */
    exportFileDir: string | undefined;

    /**
     *Amount of minutes each STP phase takes
        */
    startDate: Date | undefined;

    /**
     *Amount of minutes each STP phase takes
        */
    phaseDuration: number | undefined;

    /**
     * Sender unique id - defaults to "00000000-0000-0001-0001-000000000000"
     */
    fromSenderUUID: string | undefined;

    /**
     * Receiver unique id - defaults to "00000000-0007-0001-0000-000000000000"
     */
    toReceiverUUID: string | undefined;

    /**
     * Friendly forces name
     */
    friendFstName: string | undefined;

    /**
     * Friendly forces unique id - defaults to "00000000-0000-0001-0000-000000000000"
     */
    friendFstUUID: string | undefined;

    /**
     * Hostile forces name
     */
    hostileFstName: string | undefined;

    /**
     * Hostile forces unique id - defaults to "00000000-0000-0002-0000-000000000000"
     */
    hostileFstUUID: string | undefined;

    /**
     *Neutral forces name
        */
     neutralFstName: string | undefined;

    /**
     *Neutral forces unique id - defaults to "00000000-0000-0003-0000-000000000000"
        */
     neutralFstUUID: string | undefined;

     /**
     * Unknown forces name
     */
     unknownFstName: string | undefined;
    
     /**
     * Unknown forces unique id - defaults to "00000000-0000-0004-0000-000000000000"
     */
     unknownFstUUID: string | undefined;
}
```

### Exporting the current scenario to C2 and Simulators connected to a C2SIM server

The `exportPlanDataToC2SIMServer` retrieves the content of the current scenario in C2SIM-compliant format and 
then pushes that content to a C2SIM server. 
User UI selections specify whether an `Initialization` or an `Order` document should be produced, and 
if synbols should be filtered by affiliation, including only frindly or hostile entities.

```javascript
    const buttonExport = document.getElementById('export');
    const affilSelect = document.getElementById('affiliation');
    const typesSelect = document.getElementById('types');
    buttonExport.onclick = async () => {
        try {
            // TODO: display some sort of progress indicator/wait cursor
            if (await stpsdk.hasActiveScenario()) {
                await c2simProxy.exportPlanDataToC2SIMServer('C2SIMSample',typesSelect.value.toLowerCase(),affilSelect.value);
                log("Initialization exported to C2SIM");
            }
            else {
                log("No Active Scenario to export");
            }
        } catch (error) {
            log(error, 'Error');
        }
    };
```

The functionality, as can be seen in the C2SIM proxy code snippet copied below, is provided by lower-level SDK methods, which are described in further detail later in this document.


```javascript
  /**
   * Export current scenario initialization or orders to C2SIM 
   * @param name - Scenario name - used by some systems to label the data
   * @param dataType - Type of content: 'initialization' or 'order'
   * @param affiliation - Optional 'friend' or 'hostile' affiliation - all if omitted/null
   * @param coaPoids - optional Ids of the COAs to export - all if omitted/null
   * @param timeout - Optional timeout in seconds, 30s default 
   * @returns Formatted transfer data (e.g. C2SIM) 
   */
  async exportPlanDataToC2SIMServer(
    name: string,
    dataType: ('initialization'| 'order'),
    affiliation?: ('all' | 'friend' | 'hostile'), 
    coaPoids?: string[], 
    timeout?: number): Promise<void> {
    // Retrieve the scenario formatted as C2SIM content
    let content: string | undefined = 
      await this.getC2SIMContent(name, dataType, affiliation, coaPoids, timeout);
    // Push to the other system
    if (content) {
      this.pushC2SIMContent(content, dataType, timeout);
    }
  }
```

Parameters:

* `name` - tag/label defining the scenario being exported
* `dataType` - C2SIM plan data is grouped under `initialization` and `order` documents, the former usually representing the initial state of a scenario, and the latter representing orders issued to the taskable entities
* `affiliation` - filters the export by affiliation, if one is specified, so that only friendly or hostile elements are included
* `coaPoids` - (future capability) filters specific COAs, if more than one exist. This is in support of 
apps that opt to manage multiple COAs within the same scenario.
While this capability is supported by STP, most apps have a single COA with friend and hostile entities.

The functionality, as can be seen, is provided by lower-level SDK methods, which are described in further detail later in this document.


### Importing Initialization data from a C2SIM server into the current scenario

The `importInitializationFromC2SIMServer` method imports Initialization data from a C2SIM server. 
This is useful to populate a baseline scenario that is shared by all systems connected to the same
C2SIM server, and then use STP to issue orders, for example.

```javascript
const buttonImport = document.getElementById('import');
buttonImport.onclick = async () =>  {
    try {
        // TODO: display some sort of progress indicator/wait cursor
        if (! await stpsdk.hasActiveScenario()) {
            await stpsdk.createNewScenario(appName);
            log("New scenario created");
        }
        await c2simProxy.importInitializationFromC2SIMServer();
        log("Initialization imported from C2SIM into the current scenario");
    } catch (error) {
        log(error, 'Error');
    }
};
```

Once more, the method relies on lower-level calls as shown in the C2SIM proxy code snippet below. 
These calls are described in further detail in the next section.


```javascript
  /**
   * Import initialization data from C2SIM
   * @param timeout Optional timeout in seconds
   */
  async importInitializationFromC2SIMServer(timeout?: number) : Promise<void> {
    // Pull from the other system
    let content: string | undefined 
      = await this.pullC2SIMInitialization(timeout);
    // Convert to STP
    let stpContent: string = await this.convertC2SIMContent(content);
    // Load into scenario
    await this.syncScenarioSession(stpContent, timeout);
  }
```

### Lowr-level methods

#### Retrieving C2SIM-compliant representations

A C2SIM representation of the current scenario can be retrieved via the 
`getC2SIMContent` method.
Each call returns an Initialization or an Order document. See the [OpenC2SIM documentation](https://github.com/hyssostech/OpenC2SIM.github.io/tree/master/Standard/C2SIM) for details.

```javascript
  /**
   * Get plan data formatted for transfer to C2SIM 
   * @param name - Scenario name - used by some systems to label the data
   * @param dataType - Type of content: 'initialization' or 'order'
   * @param affiliation - Optional 'friend' or 'hostile' affiliation - all if omitted/null
   * @param coaPoids - optional Ids of the COAs to export - all if omitted/null
   * @param timeout - Optional timeout in seconds
   * @returns Formatted transfer data (e.g. C2SIM) 
   */
  async getC2SIMContent(
    name: string,
    dataType: ('initialization'| 'order'),
    affiliation?: ('all' | 'friend' | 'hostile'), 
    coaPoids?: string[], 
    timeout?: number): Promise<string>
```

#### Pushing C2SIM-compliant content to a C2SIM server

C2SIM-compliant XML documents can be pushed to a C2SIM server, becoming available to other systems connected to that server, via the `pushC2SIMContent` method.

```javascript
  /**
   * Push plan data formatted for transfer to C2SIM server
   * The actual system is determined by the active export/import Connector/bridge that 
   * is running as part of the STP Engine in use
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param dataType - Type of content: 'initialization' or 'order'
   * @param timeout - Optional timeout in seconds
   */
  async pushC2SIMContent(content: string, dataType: ('initialization' | 'order'), timeout?: number): Promise<void>
```

#### Pulling/retrieving Initialization content from a C2SIM server

To retrieve the Initialization document from a C2SIM server, the `pullC2SIMInitialization` method can be used. 
This is useful for instance when one wants to populate a scenario with the shared entities, and then use STP to build Orders.

```javascript
  /**
   * Pull initialization data from a connected C2SIM server, converting and 
   * loading it into the current STP scenario
   * The actual system is determined by the active export/import Connector/bridge that 
   * is running as part of the STP Engine in use
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param timeout - Optional timeout in seconds
   */
  async pullC2SIMInitialization(timeout?: number): Promise<string>
```

#### Converting C2SIM-compliant content to native STP format

To import content such as the one retrieved by the previous method (`pullC2SIMInitialization`) into STP, it needs to be converted to STP's native format using `convertC2SIMContent`.

NOTE: While this sample converts Initialization documents retrieved from a C2SIM Server, this method
can be used to convert Order documents as well.
When converting Orders, Tactical Graphics are extracted, but Tasks are not created at this point.
Stp's Tasks contain more details than currently captured by C2SIM, and it is not straightforward to
fill out the missing information when loading a C2SIM Order file.

Once converted, the SDK's scenario management methods (see the [Scenario sample](../scenario/)) can be used to load it into a scenario.


```javascript
  /**
   * Convert C2SIM content to native STP
   * @param content C2SIM-formatted content
   * @param timeout - Optional timeout in seconds
   * @return Stp native content, formatted as object_set([[element1], [element2], ...])
   */
  async convertC2SIMContent(content: string, timeout?: number): Promise<string>
```

### Report events

C2SIM systems (in particular Simulators) may update properties of an entity,
for example its location, or status.
The `onSymbolReport` event is triggered whenever such a report is received
by STP.

In this example, the entity is simply updated. A more realistic app may
consider showing tracks, keeping the symbol in its original position
and rendering the updates in a distinct way, or some other approach 
to show the evolution of the entity over time. 

```javascript
// The properties of a symbol were updated by C2SIM 
c2simProxy.onSymbolReport = (poid, symbol) => {
    // Remove current version
    map.removeFeature(poid);
    // Add the updated symbol
    let gj = new BasicRenderer(symbol).asGeoJSON();
    map.addFeature(gj);
};
```

NOTE: some reports may contain unchanged properties, as systems may choose to 
inform the status for all symbols being tracked, even if there were no actual
updates. 
Depending on the number of entities, it may be advisable to check for changes
before spending resources rendering.