/**
 * STP connection interface
 * @interface
 */
export interface IStpConnector {
    /**
     * Name of the service connected to STP
     */
    baseName: string;
  
    /**
     * Unique service instance name, different if there are concurrent instances running
     */
    name: string;
  
    /**
     * True if the connection is open and capable of sending and receiving messages
     */
    isConnected: boolean;
  
    /**
     * Connect and register the service, informing of the subscriptions it handles / consumes
     * @param serviceName - Name of the service that is connecting
     * @param solvables - Array of messages that this service handles
     * @param timeout - Number fo seconds to wait for a connection before failing
     */
    connect(
      serviceName: string,
      solvables: string[],
      timeout?: number
    ): Promise<void>;
  
    /**
     * Disconnect from STP
     */
    disconnect(timeout?: number): Promise<void>;
  
    /**
     * Send a message/command to STP
     * @param message - STP API message to send
     */
    inform(message: string, timeout?: number): Promise<void>;
    /**
     * Make a STP request - equivalent to an RPC call
     * @param message - STP API message to send
     * @returns STP API responses
     */
    request(message: string, timeout?: number): Promise<string[]>;
  
    /**
     * Event handler invoked by STP when a message matching one of the Solvables is posted by some service
     * @param message - STP API message to handle
     */
    onInform: ((message: string) => void) | undefined;
    /**
     * Event handler invoked by STP when a service makes a request matching one of the Solvables
     * @param message - STP API message to handle
     * @returns STP API response
     */
    onRequest: ((message: string) => string[]) | undefined;
    /**
     * Event handler invoked when a connection error occurs
     * @param error - Error description
     */
    onError: ((error: string) => void) | undefined;
  }
  
  /**
   * STP connection construction interface
   * @interface
   */
  export interface IStpConnectorConstructor {
    /**
     * Create an STP  connection object
     * @param connstring - Connection string - may vary depending on the requirements of the connector
     */
    new (connstring: string): IStpConnector;
  }
  