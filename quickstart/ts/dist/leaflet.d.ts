import { LatLon, Size, StpSymbol } from "sketch-thru-plan-sdk";
type InfoHandlers = {
    selector: string;
    handler: (event: Event) => void;
    closeInfo: boolean;
};
export declare class LeafletMap {
    onStrokeStart: ((location: LatLon, timestamp: string) => void) | undefined;
    onStrokeCompleted: ((pixelBoundsWindow: Size, topLeftGeoMap: LatLon, bottomRightGeoMap: LatLon, strokePoints: LatLon[], timeStrokeStart: string, timeStrokeEnd: string, intersectedPoids: string[]) => void) | undefined;
    onSelection: ((symbol: StpSymbol) => void) | undefined;
    apiKey: string | null;
    mapDivId: string;
    map: any;
    mapCenter: LatLon;
    zoomLevel: number;
    strokeStart: string;
    strokeEnd: string;
    strokePoly: any | null;
    geoJsonLayer: any;
    featureLayers: Map<string, any>;
    constructor(apiKey: string | null, mapDivId: string, mapCenter: LatLon, zoomLevel: number);
    load: () => Promise<void>;
    initMap(): Promise<void>;
    private drawFreeHand;
    private enableDrawing;
    private disableDrawing;
    addFeature(symbolGeoJSON: GeoJSON.Feature): void;
    removeFeature(poid: string): void;
    displayInfo(content: string, location: LatLon, handlers: InfoHandlers[]): void;
    clearInk(): void;
    getBounds(): any;
    private getIsoTimestamp;
}
export {};
