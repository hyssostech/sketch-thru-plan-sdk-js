# STP Connection Plugins

The Sketch-thru-Plan (STP) recognizer requires a connector configuration during initialization. This connection is used by the recognizer to send and receive messages/events to/from STP (see the [quicktstarts](../../quickstart)).

The services of the connector are mostly used by the SDK code itself, with the functionality described here mostly hidden from client applications. These details are important for developers that are creating their own connectors, for example to some message queuing mechanism their system uses, behind which STP operates.

The STP recognizer expects connection services to comply with the `IStpConnector` interface:

```javascript
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
    connect(serviceName: string, solvables: string[], timeout?: number): Promise<void>;

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
    onInform: (message: string) => void;
    /**
     * Event handler invoked by STP when a service makes a request matching one of the Solvables
     * @param message - STP API message to handle
     * @returns STP API response
     */
    onRequest: (message: string) => string;
    /**
     * Event handler invoked when a connection error occurs
     * @param error - Error description
     */
    onError: (error: string) => void;
}
```

The mechanism is fairly generic, requiring means for emitting asynchronous messages/event notifications - `inform` - which do not produce any return data, as well as RPC-style `request` query messages that return results.

STP components generate messages/events, as well as consume them, so in this sense they operate both as clients and as servers. On connection, a list of `solvables` provides the names of the messages/events that the component is able to handle, or is interested in being notified of:

```javascript
let solvables = ["SpeechRecognized", "PenDown", "InkProcessed","SymbolAdded", "SymbolModified","SymbolDeleted", "StpMessage"];
```

A system handling the STP component connections is required to route to the component those messages/events listed as solvables, invoking `onInform` or `onRequest` depending on the whether the message being routed was posted via an `inform` or a `request` respectively. Informs do generate any return types, whereas Requests do, to support queries.  

The [`websockets`](websockets-plugin) plugin implements this interface via Websockets. The STP server provides a native publish/subscribe mechanism, based on the Open Agent Architecture (OAA) framework, but other Websockets based mechanisms could be used on the server side as well.

This plugin is used in the [quicktstarts](../../quickstart) to provide the main SDK object the means to communicate with STP.  