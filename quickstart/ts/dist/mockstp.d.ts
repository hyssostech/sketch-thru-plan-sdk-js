import { LatLon, StpSymbol, Size } from "sketch-thru-plan-sdk";
export declare class MockRecognizer {
    onSymbolAdded: ((alternates: StpSymbol[], isUndo: boolean) => void) | undefined;
    onSymbolModified: ((poid: string, symbol: StpSymbol, isUndo: boolean) => void) | undefined;
    onSymbolDeleted: ((poid: string, isUndo: boolean) => void) | undefined;
    onInkProcessed: (() => void) | undefined;
    onSpeechRecognized: ((phrases: string[]) => void) | undefined;
    onStpMessage: ((msg: string, level: string) => void) | undefined;
    connect(serviceName: string, timeout?: number, machineId?: string | null): Promise<void>;
    disconnect(timeout?: number): Promise<void>;
    sendPenDown(location: LatLon, timestamp: string): void;
    sendInk(pixelBoundsWindow: Size, topLeftGeoMap: LatLon, bottomRightGeoMap: LatLon, strokePoints: LatLon[], timeStrokeStart: string, timeStrokeEnd: string, intersectedPoids: string[]): void;
    sendSpeechRecognition(results: {
        text: string;
    }[], startTime: string, endTime: string): void;
    deleteSymbol(poid: string): void;
}
