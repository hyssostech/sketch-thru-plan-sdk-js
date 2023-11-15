# C2SIM sample

This sample adds custom command handling to the  [Custom Cmmands](../commands) sample. 

Command and Control Systems to Simulation Systems Interoperation (C2SIM) is defined in SISO-STD-019-2020 as a standard for expressing and exchanging Command and Control (C2) information among C2 systems, simulation systems, and robotic and autonomous (RAS) systems in a coalition context.

For a comprehensive C2SIM description, see the [C2SIM Overview](https://github.com/hyssostech/OpenC2SIM.github.io/blob/master/Reference/C2SIM-Overview1.pdf). For additional details see the official [OpenC2SIM github](https://github.com/OpenC2SIM/OpenC2SIM.github.io) repo, or [Hyssos' fork](https://github.com/hyssostech/OpenC2SIM.github.io), with some additional documentation.

For general STP Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).

This sample requires an STP server deployment that includes a C2SIM Connector component, properly configured to interact with a C2SIM Server. 
Contact Hyssos for details on how to configure this environment.

Capabilities illustrated by this sample include:

* Exporting the current scenario to C2 and Simulators connected to a C2SIM server
* Importing Initialization data from a C2SIM server into the current scenario

These higher level capabilities are implemented as compositions of lower-level services also exposed by the SDK:

* Retrieving C2SIM-compliant representations of the current scenario
* Pushing C2SIM-compliant content to a C2SIM server
* Pulling/retreiving Initialization content from a C2SIM server
* Converting C2SIM-compliant content to native STP format

## Code walkthrough

See the [gmaps sample](../gmaps) for details on most of the code. Here just the changes introduced in this sample - custom command handling - are described.

### Exporting the current scenario to C2 and Simulators connected to a C2SIM server

The `exportPlanDataToC2SIMServer` retrieves the content of the current scenario in C2SIM compliant format and 
then pushes that content to a C2SIM server.

```javascript
const buttonExport = document.getElementById('export');
buttonExport.onclick = async () => {
    try {
        // TODO: display some sort of progress indicator/wait cursor
        if (await stpsdk.hasActiveScenario()) {
            await stpsdk.exportPlanDataToC2SIMServer('C2SIMSample','initialization','all');
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

The functionality, as can be seen in the SDK code snippet copied below, is provided by lower-level SDK methods, which are described in further detail later in this document.


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
* `dataType` - C2SIM plan data is grouped under `initialization` and oOrder` documents, the former usually representing the intiial state of a scenario, and the latter representing orders issued to the taskable entities
* `affiliation` - filters the export by affiliation, if one is specified
* `coaPoids` - (future capability) filters specific COAs, if more than one exist. This is in support of 
apps that opt to manage multiple COAs within the same scenario.
While this capability is supported by STP, most apps have a single COA with frien and hostile entities.

The functionality, as can be seen, is provided by lower-level SDK methods, which are described in further detail later in this document.


### Importing Initialization data from a C2SIM server into the current scenario

The `importInitializationFromC2SIMServer` method imports Initializaiton data from a C2SIM server. 
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
        await stpsdk.importInitializationFromC2SIMServer();
        log("Initialization imported from C2SIM into the current scenario");
    } catch (error) {
        log(error, 'Error');
    }
};
```

Once more, the method relies on lower-level SDK calls as shown in the SDK code snippet below. These calls are described in further detail in the next scetion.


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

A C2SIM representaiton of the current scenario can be retrieved via the 
`getC2SIMContent` method.
Each call returns an Intialization or an Order document. See the [OpenC2SIM documentation](https://github.com/hyssostech/OpenC2SIM.github.io/tree/master/Standard/C2SIM) for details.

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
   * The actual system is determined by the active export/inmport Connector/bridge that 
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

