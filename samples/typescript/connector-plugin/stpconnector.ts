import { IStpConnector } from "./interfaces/IStpConnector";

/**
 * Implements a connector to STP's pub/sub service via WebSockets
 * @implements IStpConnector - {@link IStpConnector}
 */
export class StpWebSocketsConnector implements IStpConnector {
    //#region Websocket used to communicate to STP
    connstring: string;
    socket: WebSocket;
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
        return this.socket && this.socket.readyState  === this.socket.OPEN; 
    }
    get isConnecting(): boolean {
        return this.socket && this.socket.readyState === this.socket.CONNECTING;
    }
    get connState() : string {
        return this.socket ? this.socket.readyState.toString() : "";
    }
    //#endregion

    //#region Constants
    readonly DEFAULT_TIMEOUT:number = 30;
    //#endregion

    //#region Construction
    /**
     * Construct a connection object
     * @param connstring Websocket connection string - "ws:server.com:port"
     */
    constructor(connstring: string) {
        this.connstring = connstring;
    }
    //#endregion

    //#region Connection / disconnection
    /**
    * Connect and register the service, informing of the subscriptions it handles / consumes
    * @param serviceName - Name of the service that is connecting
    * @param solvables - Array of messages that this service handles
    * @param timeout - Number fo seconds to wait for a connection before failing
    */
   async connect(serviceName: string, solvables: string[], timeout?: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            // Bail out if already connected
            if (this.isConnected) {
                resolve();
            }
            // Save the connection parameters inc ase there is a need to reconnect
            this.serviceName = serviceName;
            this.solvables = solvables;
            this.timeout = timeout;

            // COnnect and register
            try {
                this.socket = await this.promiseWithTimeout(0, this.tryConnect(this.connstring));
                await this.register(this.serviceName, this.solvables, this.timeout);
            } catch (e) {
                reject(new Error("Failed to connect: " + e.message));
                return;   
            }

            // Invoke the clients events that propagate the socket state
            this.socket.onmessage = (ev) => {
                if (this.onInform)
                    this.onInform(ev.data);
            };
            
            this.socket.onerror = (ev) => {
                if (this.onError) {
                    this.onError("STP connection error");
                }
            };

            this.socket.onclose = async (ev) => {
                // Attempt to reconnect if it is not already in the process of doing so
                if (! this.isConnecting) {
                    try {
                        // Reconnect using the original saved connection parameters
                        await this.connect(this.serviceName, this.solvables, this.timeout);
                    } catch (error) {
                        if (this.onError) {
                            // Add a user readable reason
                           this.onError("Failed to reconnect to STP. Check that the service is running and refresh page to retry");
                        }
                    }
                }
            };
            resolve();
        });
    }

    private register(serviceName: string, solvables: string[], timeout?: number): Promise<void> {
        // Error if the connection is dead
        if (!this.isConnected) {
            throw new Error("Failed to register: connection is not open (" + this.connState+ ")");
        }
        return this.promiseWithTimeout(timeout, 
            new Promise<void>(async (resolve, reject) => {
                // Set the names
                this.baseName = serviceName;
                this.name = this.baseName + "_" + this.uniqueId(9);

                // Register with the pub/sub system
                this.socket.send(JSON.stringify(
                    {
                        method: "Register", 
                        params : { 
                            serviceName: this.name,
                            language: "javascript",
                            solvables: solvables.join(), 
                        }
                    }));
                resolve();
            })
        );
    }

    disconnect(timeout?: number): Promise<void> {
        return this.promiseWithTimeout(timeout, 
            new Promise<void>(async (resolve, reject) => {
                if (!this.isConnected) {
                    // Attempt to close
                    this.socket.close();
                }
                resolve();
            })
        )
    }
    //#endregion

    //#region Messaging
    inform(message: string, timeout?: number): Promise<void> {
        // Error if the connection is dead
        if (!this.isConnected) {
            throw new Error("Failed to send message: connection is not open (" + this.connState+ ")");
        }
        return this.promiseWithTimeout(timeout, 
            new Promise<void>(async (resolve, reject) => {
                // Attempt to send
                this.socket.send(message);
                resolve();
            })
        )
    }

    request(message: string, timeout?: number): Promise<string[]> {
        // TODO: complete the request (emulates a synchronous RPC call)
        throw new Error("Method not implemented");
        // Error if the connection is dead
        if (!this.isConnected) {
            throw new Error("Failed to send request: connection is not open (" + this.connState+ ")");
        }
        return this.promiseWithTimeout(timeout, 
            new Promise<void>(async (resolve, reject) => {
                // Attempt to send
                this.socket.send(message);
                resolve();
            })
        )
    }
    //#endregion

    //#region Events
    onInform: (message: string) => void;
    onRequest: (message: string) => string;
    onError: (error: string) => void;
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
            socket.onerror = (err) => reject(new Error("Unspecified error communicating with STP"));
        });
    }

     /**
     * Limits the amount of time a promise has to resolve/reject
     * @param timeout Timeout in seconds
     * @param promise Promise that will be aborted if timeout is exceeded
     */
    private promiseWithTimeout(timeout: number, promise: Promise<any>) {
        // Set timeout to default (30s) if not provided (zero)
        if (! timeout)  timeout = this.DEFAULT_TIMEOUT;
        // Returns the promise that first resolves/rejects - that bounds the execution time to be that of the timeout,
        // as that would "win the race" and force a rejection error in case the other promise still did not produce results
        return Promise.race([
            promise,
            new Promise((resolve, reject) => {
                let id = setTimeout(() => {
                    clearTimeout(id);
                    reject(new Error("Operation timed out"))
                }, timeout * 1000)
            })
        ])
    }

    /**
     * Generates a unique/random id
     * @param numChars Number of characters to return - max [default] 9
     */
    private uniqueId(numChars?: number) : string {
        if (! numChars)
            numChars = 9;
        return Math.random().toString(36).substr(2, numChars);
    }
    //#endregion 
}
