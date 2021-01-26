import { IStpConnector } from '../../interfaces/IStpConnector';

/**
 * Implements a connector to STP's native OAA pub/sub service via WebSockets
 * @implements IStpConnector - {@link IStpConnector}
 */
export default class StpWebSocketsConnector implements IStpConnector {
  //#region Websocket used to communicate to STP
  connstring: string;
  socket: WebSocket | null;
  //#endregion

  //#region Service identifiers
  baseName: string;
  name: string;
  //#endregion

  //#region Connection parameters
  serviceName: string;
  solvables: string[];
  timeout: number;
  //#endregion

  //#region Connection status accesssors
  get isConnected(): boolean {
    return this.socket != null && this.socket.readyState === this.socket.OPEN;
  }
  get isConnecting(): boolean {
    return this.socket != null && this.socket.readyState === this.socket.CONNECTING;
  }
  get connState(): string {
    return this.socket ? this.socket.readyState.toString() : '';
  }
  //#endregion

  //#region Constants
  readonly DEFAULT_TIMEOUT: number = 30;
  //#endregion

  //#region Construction
  /**
   * Construct a connection object
   * @param connstring Websocket connection string - "ws://server.com:port"
   */
  constructor(connstring: string) {
    this.connstring = connstring;
    this.socket = null;
    this.baseName = '';
    this.name = '';
    this.serviceName = '';
    this.solvables = [];
    this.timeout = 0;
  }
  //#endregion

  //#region Connection / disconnection
  /**
   * Connect and register the service, informing of the subscriptions it handles / consumes
   * @param serviceName - Name of the service that is connecting
   * @param solvables - Array of messages that this service handles
   * @param timeout - Number fo seconds to wait for a connection before failing
   */
  async connect(
    serviceName: string,
    solvables: string[],
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      // Bail out if already connected
      if (this.isConnected) {
        resolve();
      }
      // Save the connection parameters inc ase there is a need to reconnect
      this.serviceName = serviceName;
      this.solvables = solvables;

      // Connect and register
      try {
        this.socket = await this.promiseWithTimeout<WebSocket>(
          0,
          this.tryConnect(this.connstring)
        );
        await this.register(this.serviceName, this.solvables, this.timeout);
      } catch (e) {
        reject(new Error('Failed to connect: ' + e.message));
        return;
      }

      // Invoke the clients events that propagate the socket state
      this.socket!.onmessage = (ev) => {
        if (this.onInform) this.onInform(ev.data);
      };

      this.socket!.onerror = (ev) => {
        if (this.onError) {
          this.onError(
            'Error connecting to STP. Check that the service is running and refresh page to retry'
          );
        }
      };

      this.socket!.onclose = async (ev) => {
        // Attempt to reconnect if it is not already in the process of doing so
        if (!this.isConnecting) {
          try {
            // Reconnect using the original saved connection parameters
            await this.connect(this.serviceName, this.solvables, this.timeout);
          } catch (error) {
            if (this.onError) {
              // Add a user readable reason
              this.onError(
                'Lost connection to STP. Check that the service is running and refresh page to retry'
              );
            }
          }
        }
      };
      resolve();
    });
  }

  private register(
    serviceName: string,
    solvables: string[],
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<void> {
    // Error if the connection is dead
    if (!this.isConnected) {
      throw new Error(
        'Failed to register: connection is not open (' + this.connState + ')'
      );
    }
    return this.promiseWithTimeout<void>(
      timeout,
      new Promise<void>(async (resolve, reject) => {
        if (!this.socket) {
          reject;
          return;
        }
        // Set the names
        this.baseName = serviceName;
        this.name = this.baseName + '_' + this.getUniqueId(9);

        // Handshake with PubSub system behind the websockets connection
        this.socket.send(
          JSON.stringify({
            method: 'Register',
            params: {
              serviceName: this.name,
              language: 'javascript',
              solvables: solvables.join()
            }
          })
        );
        resolve();
      })
    );
  }

  disconnect(timeout: number = this.DEFAULT_TIMEOUT): Promise<void> {
    return this.promiseWithTimeout<void>(
      timeout,
      new Promise<void>(async (resolve, reject) => {
        if (!this.isConnected && this.socket) {
          // Attempt to close
          this.socket.close();
        }
        resolve();
      })
    );
  }
  //#endregion

  //#region Messaging
  inform(message: string, timeout: number = this.DEFAULT_TIMEOUT): Promise<void> {
    // Error if the connection is dead
    if (!this.isConnected) {
      throw new Error(
        'Failed to send inform: connection is not open (' + this.connState + ')'
      );
    }
    return this.promiseWithTimeout<void>(
      timeout,
      new Promise<void>(async (resolve, reject) => {
        if (! this.socket) {
          reject;
          return;
        }
        // Attempt to send
        this.socket.send(message);
        resolve();
      })
    );
  }

  request(message: string, timeout: number = this.DEFAULT_TIMEOUT): Promise<string[]> {
    throw new Error('Method not implemented');
    // Error if the connection is dead
    if (!this.isConnected || !this.socket) {
      throw new Error(
        'Failed to send request: connection is not open (' +
          this.connState +
          ')'
      );
    }
    return this.promiseWithTimeout<void>(
      timeout,
      new Promise<void>(async (resolve, reject) => {
        // Attempt to send
        this.socket!.send(message);
        resolve();
      })
    );
  }
  //#endregion

  //#region Events
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  //#endregion

  //#region Private utility members
  /**
   * Try to connect (once) to a websocket endpoint
   * @internal
   * @param connstring - WebSocket endpoint to connect to
   */
  private tryConnect(connstring: string): Promise<WebSocket> {
    return new Promise<WebSocket>((resolve, reject) => {
      var socket: WebSocket = new WebSocket(connstring);
      socket.onopen = () => resolve(socket);
      socket.onerror = (err) =>
        reject(new Error('Unspecified error communicating with STP'));
    });
  }

  /**
   * Limits the amount of time a promise has to resolve/reject
   * @param timeout Timeout in seconds
   * @param promise Promise that will be aborted if timeout is exceeded
   */
  private promiseWithTimeout<T>(
    timeout: number,
    promise: Promise<T>
  ): Promise<T | any> {
    // Returns the promise that first resolves/rejects - that bounds the execution time to be that of the timeout,
    // as that would "win the race" and force a rejection error in case the other promise still did not produce results
    return Promise.race([
      promise,
      new Promise((resolve, reject) => {
        let id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error('Operation timed out'));
        }, timeout * 1000);
      })
    ]);
  }

  /**
   * Generates a unique/random id
   * @param numChars Number of characters to return - max [default] 9
   */
  private getUniqueId(numChars?: number): string {
    if (!numChars) numChars = 9;
    return Math.random().toString(36).substr(2, numChars);
  }

  //#endregion
}
/*
    //UNTESTED
    private retriedExecution(numRetries: number, timeout: number, promise: Promise<any>, failMsg: string) {
        return new Promise<void>(async (resolve, reject) => {
            // Set timeout to default if not provided (zero)
            if (! timeout)  timeout = this.DEFAULT_TIMEOUT;
 
            let delay: number = 250;
            let count:number = 1;
            for ( ; ; )
            {
                try {
                    // Attempt to fulfill the promise within the timeout period
                    await this.promiseWithTimeout(timeout, promise);
                    // Exit loop if operation completed successfully
                    resolve();
                    return;
                } catch (e) {
                    // Just swallow the issue - likely a timeout - so the oper can be retried
                }
                // Exit if exceeded the number of retries
                if  (count++ >= numRetries) {
                    break;
                }
                // Pause before next attemp, waiting a bit longer each time
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 1.5;
            }
            // Failed after all retries
            reject(new Error(failMsg));
        });
    }
*/
