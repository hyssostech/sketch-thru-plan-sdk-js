import { IStpConnector } from './interfaces/IStpConnector';

/**
 * Implements a connector to STP's native OAA pub/sub service via WebSockets
 * @implements IStpConnector - {@link IStpConnector}
 */
export class StpWebSocketsConnector implements IStpConnector {
  /**
   * Builds the Error a refused request rejects with. STP sends a null result when it cannot
   * dispatch a method, so there is frequently no text to relay; say what is known rather than
   * rejecting with an empty value that tells the caller nothing.
   * @param result - the `result` field of the RequestResponse, often null
   */
  static refusalError(result: any): Error {
    if (result instanceof Error) return result;
    let text = '';
    if (typeof result === 'string') text = result;
    else if (typeof result === 'number' || typeof result === 'boolean') text = String(result);
    else if (result !== null && typeof result === 'object') {
      // Some failures carry a structured payload; its own message is the useful part, and
      // String() on an object would throw all of it away as "[object Object]".
      text = typeof result.message === 'string' ? result.message : JSON.stringify(result);
    }
    text = text.trim();
    return new Error(
      text !== ''
        ? text
        : 'STP refused the request and gave no reason. The usual cause is a method this engine does not dispatch; check the engine log for "No handler for method".'
    );
  }

  //#region Websocket used to communicate to STP
  connstring: string;
  socket: WebSocket | null;
  //#endregion

  //#region Service identifiers
  name: string | undefined;
  //#endregion

  //#region Connection parameters
  serviceName: string | undefined;
  solvables: string[] | undefined;
  timeout: number | undefined;
  machineId: string | undefined;
  sessionId: string | undefined;
  //#endregion

  //#region Connection status accesssors
  get isConnected(): boolean {
    return this.socket != null && this.socket.readyState === this.socket.OPEN;
  }
  get isConnecting(): boolean {
    return (
      this.socket != null && this.socket.readyState === this.socket.CONNECTING
    );
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
  }
  //#endregion

  //#region Connection / disconnection
  /**
   * Connect and register the service, informing of the subscriptions it handles / consumes
   * @param serviceName - Name of the service that is connecting
   * @param solvables - Array of messages that this service handles
   * @param timeout - Optional number of seconds to wait for a connection before failing
   * @param machineId - Optional machine Id to use. If not provided, no id is sent and STP uses the host's id.
   * @param sessionId - Optional session Id to use. If not provided:
   *  1. the suffix to the WebSocket connection string is used 
   *  2. otherwise STP assigns its default session (the host's id)
   * @returns The actual sessionId used - the one provided here or a default set by STP
   */
  async connect(
    serviceName: string,
    solvables: string[],
    timeout: number = this.DEFAULT_TIMEOUT,
    machineId: string | null = null,
    sessionId: string | null = null
  ): Promise<string | undefined> {
    return new Promise<string | undefined>(async (resolve, reject) => {
      // Bail out if already connected
      if (this.isConnected) {
        resolve(this.sessionId);
      }
      // Save the connection parameters inc ase there is a need to reconnect
      this.serviceName = serviceName;
      this.solvables = solvables;
      if (machineId != null) {
        this.machineId = machineId;
      }
      if (sessionId != null) {
        this.sessionId = sessionId;
      }

      // Set timeout if needed
      if (timeout <= 0) {
        timeout = this.DEFAULT_TIMEOUT;
      }

      // Connect and register
      try {
        this.socket = await this.promiseWithTimeout<WebSocket>(
          timeout,
          this.tryConnect(this.connstring)
        );
      } catch (e) {
        reject(new Error('Failed to connect: ' + (e as Error).message));
        return;
      }

      // Setup the client event handlers that propagate the socket state
      this.socket!.onmessage = (ev) => {
        // Deal with meta-messages 
        // Parse message into the generic (JsonRPC) { method: 'name', params: {}} envelope
        const msg = JSON.parse(ev.data) as {
          method: string;
          params: object;
        };
        if (msg.method === "RequestResponse") {
          // Extract request response parameters
          const params = msg.params as {
            cookie: number;
            success: boolean;
            result: any;
          }
          // Look for tracker matching the cookie parameter
          let index: number = Tracker.trackedResponses.findIndex(t => t.cookie === params.cookie);
          let tracker: Tracker | undefined = Tracker.trackedResponses.find(t => t.cookie === params.cookie);
          if (index > -1) {
            // Extract the tracker from the array
            let tracker: Tracker = Tracker.trackedResponses.splice(index, 1)[0];
            // Resolve the future with the result
            if (params.success) {
              tracker.responseFuture.resolve(params.result);
            }
            else {
              // STP answers a method it cannot dispatch with success:false and a null result.
              // Rejecting with that raw value handed the caller a rejection whose reason was
              // `null` - no Error, no message, no stack - which is how the COA calls this SDK
              // sends but the engine never dispatches stayed invisible. Engines from 2026-09 put
              // the reason in the result; keep that text, and supply one when there is none.
              tracker.responseFuture.reject(StpWebSocketsConnector.refusalError(params.result));
            }
          }
        }
        else {
          // Pass message through to subscribers (normally the stp sdk)
          if (this.onInform) this.onInform(ev.data);
        }
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
            await this.connect(
              this.serviceName!,
              this.solvables!,
              this.timeout,
              this.machineId
            );
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

      // Registration - subscribe to events, save session id used (might have been set by a default)
      // NB: registration relies on `request`, which only works if `onmessage` has been 
      try {
        this.sessionId = await this.register(timeout);
      } catch (e) {
        reject(new Error('Failed to register with STP: ' + (e as Error).message));
        return;
      }


      // Return the sessionId used
      resolve(this.sessionId);
    });
  }

  private register(timeout: number = this.DEFAULT_TIMEOUT): Promise<string> {
    // Error if the connection is dead
    if (!this.isConnected) {
      throw new Error(
        'Failed to register: connection is not open (' + this.connState + ')'
      );
    }
    // Set the names
    this.name = this.serviceName;

    // Format the message
    let msg = {
      method: 'Register',
      params: {
        serviceName: this.serviceName,
        language: 'javascript',
        solvables: this.solvables,
        machineId: this.machineId || null,
        sessionId: this.sessionId
      }
    };

    // Send PubSub system handshake message
    return this.request(JSON.stringify(msg), timeout);
  }

  /**
   * Replace the current solvables (event subscriptions) and re-register with STP.
   * Subscriptions are otherwise fixed at the time connect() first runs, so this is the way to
   * pick up handlers that are attached after the connection has already been established.
   * @param solvables - Updated array of messages this service handles
   * @param timeout - Optional number of seconds to wait for the re-registration to complete
   * @returns The sessionId returned by STP's registration response
   */
  async updateSolvables(
    solvables: string[],
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<string> {
    if (!this.isConnected) {
      throw new Error(
        'Failed to update subscriptions: connection is not open (' + this.connState + ')'
      );
    }
    this.solvables = solvables;
    const sessionId: string = await this.register(timeout);
    this.sessionId = sessionId;
    return sessionId;
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
  inform(
    message: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<void> {
    // Error if the connection is dead
    if (!this.isConnected) {
      throw new Error(
        'Failed to send inform: connection is not open (' + this.connState + ')'
      );
    }
    return this.promiseWithTimeout<void>(
      timeout,
      new Promise<void>(async (resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Failed to send inform: socket is not available'));
          return;
        }
        // Attempt to send
        this.socket.send(message);
        resolve();
      })
    );
  }

  async request(
    message: string,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<any> {
    // Error if the connection is dead
    if (!this.isConnected || !this.socket) {
      throw new Error(
        'Failed to send request: connection is not open (' + this.connState + ')'
      );
    }
    // Create object to track responses 
    let tracker: Tracker = new Tracker();

    // Send the message and wait for response
    return this.promiseWithTimeout<any>(
      timeout,
      new Promise<any>(async (resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Failed to send request: socket is not available'));
          return;
        }
        // Bind outcome to the future promise that will resolve/reject when response is received
        //tracker.responseFuture.resolve.bind(resolve);
        //tracker.responseFuture.reject.bind(reject);
        // Build request meta-message, injecting cookie into message so that STP can tag the response 
        const requestMessage: any = {
          method: "Request",
          params: {
            jsonRequest: message,
            cookie: tracker.cookie,
            timeout: timeout,
          }
        };
        // Attempt to send
        this.socket.send(JSON.stringify(requestMessage));
        // Wait until a RequestResponse message is received that matches this cookie
        // Resolve or reject are then invoked depending on success message parameter
        tracker.responseFuture
          .then( (value: any) => resolve(value))
          .catch( (reason: any) => reject(reason));
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

  //#endregion
}

/**
 * Request tracking
 */
class Tracker {
  static lastCookie: number = 0;
  static trackedResponses: Tracker[] = [];

  /**
   * Response identifier - response message will make reference to it
   */
  cookie: number;
  /**
   * Future object that gets resolved when a response matching the cookie is received
   */
  responseFuture: Future<any>;

  /**
   * Adds a new response tracker
   */
  constructor() {
    this.cookie = Tracker.lastCookie++;
    this.responseFuture = new Future<any>();
    Tracker.trackedResponses.push(this);
  }
}

// From https://stackoverflow.com/a/40356701
class Future<T> implements PromiseLike<T> {
  private promise!: Promise<T>;
  private resolveFunction!: (value: T | PromiseLike<T>) => void;
  private rejectFunction!: (reason?: any) => void;

  constructor(promise?: Promise<T>) {
    this.promise = promise || new Promise<T>(this.promiseExecutor.bind(this));
  }

  public asPromise(): Promise<T> {
    return this.promise;
  }

  public then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>, onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Future<TResult>;
  public then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>, onrejected?: (reason: any) => void): Future<TResult>;
  public then<TResult>(onfulfilled?: (value: T) => TResult | PromiseLike<TResult>, onrejected?: (reason: any) => any): Future<TResult> {
    return new Future(this.promise.then(onfulfilled, onrejected));
  }

  public catch(onrejected?: (reason: any) => T | PromiseLike<T>): Future<T>;
  public catch(onrejected?: (reason: any) => void): Future<T>;
  public catch(onrejected?: (reason: any) => any): Future<T> {
    return new Future(this.promise.catch(onrejected));
  }

  public resolve(value: T | PromiseLike<T>) {
    this.resolveFunction(value);
  }

  public reject(reason?: any) {
    this.rejectFunction(reason);
  }

  private promiseExecutor(resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) {
    this.resolveFunction = resolve;
    this.rejectFunction = reject;
  }
}

/*
/**
 * Promises that can be resolved/rejected later
 * Based on https://stackoverflow.com/a/71158892
 * /
export class Deferred<T> {
  private resolveFunction: (value: T) => void = () => { };
  private rejectFunction: (value: T) => void = () => { };

  private promise: Promise<T> = new Promise<T>((resolve, reject) => {
    this.rejectFunction = reject;
    this.resolveFunction = resolve;
  })

  public get asPromise(): Promise<T> {
    return this.promise;
  }

  public resolve(value: T) {
    this.resolveFunction(value);
  }

  public reject(value: T) {
    this.rejectFunction(value);
  }
}
*/

export default StpWebSocketsConnector;
