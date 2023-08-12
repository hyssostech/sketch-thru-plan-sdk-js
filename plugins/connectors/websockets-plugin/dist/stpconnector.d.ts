interface IStpConnector {
    name: string | undefined;
    isConnected: boolean;
    connect(serviceName: string, solvables: string[], timeout?: number, machineId?: string, sessionId?: string): Promise<string | undefined>;
    disconnect(timeout?: number): Promise<void>;
    inform(message: string, timeout?: number): Promise<void>;
    request(message: string, timeout?: number): Promise<any>;
    onInform: ((message: string) => void) | undefined;
    onRequest: ((message: string) => string[]) | undefined;
    onError: ((error: string) => void) | undefined;
}

declare class StpWebSocketsConnector implements IStpConnector {
    connstring: string;
    socket: WebSocket | null;
    name: string | undefined;
    serviceName: string | undefined;
    solvables: string[] | undefined;
    timeout: number | undefined;
    machineId: string | undefined;
    sessionId: string | undefined;
    get isConnected(): boolean;
    get isConnecting(): boolean;
    get connState(): string;
    readonly DEFAULT_TIMEOUT: number;
    constructor(connstring: string);
    connect(serviceName: string, solvables: string[], timeout?: number, machineId?: string | null, sessionId?: string | null): Promise<string | undefined>;
    private register;
    disconnect(timeout?: number): Promise<void>;
    inform(message: string, timeout?: number): Promise<void>;
    request(message: string, timeout?: number): Promise<any>;
    onInform: ((message: string) => void) | undefined;
    onRequest: ((message: string) => string[]) | undefined;
    onError: ((error: string) => void) | undefined;
    private tryConnect;
    private promiseWithTimeout;
    private getUniqueId;
}

export { StpWebSocketsConnector, StpWebSocketsConnector as default };
