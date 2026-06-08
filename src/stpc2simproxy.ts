import { IC2SIMProxy } from "./interfaces/IC2SIMProxy";
import StpRecognizer from "./stprecognizer";
import * as StpType from './stptypes';
import { StpC2SIMOptions } from "./stpc2simoptions";

/**
 * Implements a connector to STP's native OAA pub/sub service via WebSockets
 * @implements IStpConnector - {@link IStpConnector}
 */
export class StpC2SIMProxy implements IC2SIMProxy {
    
    stpsdk: StpRecognizer;
    options: StpC2SIMOptions | undefined;

    //#region Construction
    /**
     * Construct a C2SIM proxy object
     * @param stpsdk - Object used to communicate with teh STP Engine 
     * @param 
     */
    constructor(stpsdk: StpRecognizer, options?: StpC2SIMOptions) {
      // Messages are relayed via the sdk
      this.stpsdk = stpsdk;
      // Optional options to inject
      this.options = options;

      // Relay Report events to proxy subscribers
      stpsdk.onSymbolReport = (poid, symbol) => {
        if (this.onSymbolReport) {
          this.onSymbolReport(poid, symbol);
        }
      };
    }
    //#endregion

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
      await this.pushC2SIMContent(content, dataType, timeout);
    }
  }
  
  /**
   * Import initialization data from C2SIM
   * @param timeout Optional timeout in seconds
   */
  async importInitializationFromC2SIMServer(timeout?: number) : Promise<void> {
    // Pull from the other system
    let content: string | undefined 
      = await this.pullC2SIMInitialization(timeout);
    // Convert to STP
    let stpContent: string = await this.convertC2SIMContent(content, timeout);
    // Load into scenario
    await this.stpsdk.syncScenarioSession(stpContent, timeout);
  }

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
    timeout?: number): Promise<string> {
    return this.stpsdk.requestStp('GetC2SIMContent', {
      name: arguments[0],
      dataType: arguments[1],
      affiliation: arguments[2],
      coaPoids: arguments[3],
      options: this.options
    }, timeout);
  }

  /**
   * Push plan data formatted for transfer to C2SIM server
   * The actual system is determined by the active export/inmport Connector/bridge that 
   * is running as part of the STP Engine in use
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param dataType - Type of content: 'initialization' or 'order'
   * @param timeout - Optional timeout in seconds
   */
  async pushC2SIMContent(content: string, dataType: ('initialization' | 'order'), timeout?: number): Promise<void> {
    return this.stpsdk.requestStp('PushC2SIMContent', {
      content: arguments[0],
      dataType: arguments[1],
      options: this.options
    }, timeout);
  }
 
  /**
   * Pull initialization data from a connected C2SIM server, converting and 
   * loading it into the current STP scenario
   * The actual system is determined by the active export/import Connector/bridge that 
   * is running as part of the STP Engine in use
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param timeout - Optional timeout in seconds
   */
  async pullC2SIMInitialization(timeout?: number): Promise<string> {
    return this.stpsdk.requestStp('PullC2SIMInitialization', {
      options: this.options 
    }, timeout);
  }

  /**
   * Convert C2SIM content to native STP
   * @param content C2SIM-formatted content
   * @param timeout - Optional timeout in seconds
   * @return Stp native content, formatted as object_set([[element1], [element2], ...])
   */
  async convertC2SIMContent(content: string, timeout?: number): Promise<string>  {
    return this.stpsdk.requestStp('ConvertC2SIMContent', {
      content: arguments[0],
      options: this.options
    }, timeout);
  }

  /**
   * A new C2SIM symbol report has been received
   * @param poid - Unique symbol identifier of the symbol updated by the report
   * @param symbol - Updated symbol properies (e.g. new location)
   */
    onSymbolReport:
    | ((poid: string, symbol: StpType.StpSymbol) => void)
    | undefined;
}