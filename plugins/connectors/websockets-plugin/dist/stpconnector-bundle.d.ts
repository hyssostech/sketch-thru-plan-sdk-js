interface IStpConnector {
    baseName: string;
    name: string;
    isConnected: boolean;
    connect(serviceName: string, solvables: string[], timeout?: number): Promise<void>;
    disconnect(timeout?: number): Promise<void>;
    inform(message: string, timeout?: number): Promise<void>;
    request(message: string, timeout?: number): Promise<string[]>;
    onInform: ((message: string) => void) | undefined;
    onRequest: ((message: string) => string[]) | undefined;
    onError: ((error: string) => void) | undefined;
}

declare class StpWebSocketsConnector implements IStpConnector {
    connstring: string;
    socket: WebSocket | null;
    baseName: string;
    name: string;
    serviceName: string;
    solvables: string[];
    timeout: number;
    get isConnected(): boolean;
    get isConnecting(): boolean;
    get connState(): string;
    readonly DEFAULT_TIMEOUT: number;
    constructor(connstring: string);
    connect(serviceName: string, solvables: string[], timeout?: number): Promise<void>;
    private register;
    disconnect(timeout?: number): Promise<void>;
    inform(message: string, timeout?: number): Promise<void>;
    request(message: string, timeout?: number): Promise<string[]>;
    onInform: ((message: string) => void) | undefined;
    onRequest: ((message: string) => string[]) | undefined;
    onError: ((error: string) => void) | undefined;
    private tryConnect;
    private promiseWithTimeout;
    private getUniqueId;
}

export default StpWebSocketsConnector;
