import * as StpType from '../stptypes';

/**
 * Stp  interface to C2SIM
 * @interface
 */
export interface IC2SIMProxy {
  /**
   * Export current scenario initialization or orders to C2SIM 
   * @param name - Scenario name - used by some systems to label the data
   * @param dataType - Type of content: 'initialization' or 'order'
   * @param affiliation - Optional 'friend' or 'hostile' affiliation - all if omitted/null
   * @param coaPoids - optional Ids of the COAs to export - all if omitted/null
   * @param timeout - Optional timeout in seconds, 30s default 
   * @returns Formatted transfer data (e.g. C2SIM) 
   */
   exportPlanDataToC2SIMServer(
    name: string,
    dataType: ('initialization'| 'order'),
    affiliation?: ('all' | 'friend' | 'hostile'), 
    coaPoids?: string[], 
    timeout?: number): Promise<void>;
  
  /**
   * Import initialization data from C2SIM
   * @param timeout Optional timeout in seconds
   */
  importInitializationFromC2SIMServer(timeout?: number) : Promise<void>;

  /**
   * Get plan data formatted for transfer to C2SIM 
   * @param name - Scenario name - used by some systems to label the data
   * @param dataType - Type of content: 'initialization' or 'order'
   * @param affiliation - Optional 'friend' or 'hostile' affiliation - all if omitted/null
   * @param coaPoids - optional Ids of the COAs to export - all if omitted/null
   * @param timeout - Optional timeout in seconds
   * @returns Formatted transfer data (e.g. C2SIM) 
   */
  getC2SIMContent(
    name: string,
    dataType: ('initialization'| 'order'),
    affiliation?: ('all' | 'friend' | 'hostile'), 
    coaPoids?: string[], 
    timeout?: number): Promise<string>;

  /**
   * Push plan data formatted for transfer to C2SIM server
   * The actual system is determined by the active export/inmport Connector/bridge that 
   * is running as part of the STP Engine in use
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param dataType - Type of content: 'initialization' or 'order'
   * @param timeout - Optional timeout in seconds
   */
  pushC2SIMContent(
    content: string, 
    dataType: ('initialization' | 'order'), 
    timeout?: number): Promise<void>;
 
  /**
   * Pull initialization data from a connected C2SIM server, converting and 
   * loading it into the current STP scenario
   * The actual system is determined by the active export/import Connector/bridge that 
   * is running as part of the STP Engine in use
   * @param content - Content to load, formatted as object_set([[element1], [element2], ...]) 
   * @param timeout - Optional timeout in seconds
   */
  pullC2SIMInitialization(timeout?: number): Promise<string>;

  /**
   * Convert C2SIM content to native STP
   * @param content C2SIM-formatted content
   * @param timeout - Optional timeout in seconds
   * @return Stp native content, formatted as object_set([[element1], [element2], ...])
   */
  convertC2SIMContent(content: string, timeout?: number): Promise<string>;

  /**
   * A new C2SIM symbol report has been received
   * @param poid - Unique symbol identifier of the symbol updated by the report
   * @param symbol - Updated symbol properies (e.g. new location)
   */
  onSymbolReport:
    | ((poid: string, symbol: StpType.StpSymbol) => void)
    | undefined;
}