interface IMapAdapter {
    onStrokeStart?: (location: {
        lat: number;
        lon: number;
    }, timestamp: string) => void;
    onStrokeCompleted?: (pixelBoundsWindow: {
        width: number;
        height: number;
    }, topLeftGeoMap: {
        lat: number;
        lon: number;
    }, bottomRightGeoMap: {
        lat: number;
        lon: number;
    }, strokePoints: Array<{
        lat: number;
        lon: number;
    }>, timeStrokeStart: string, timeStrokeEnd: string, intersectedPoids: string[]) => void;
    onSelection?: (symbol: any) => void;
    apiKey: string | null;
    mapCenter: {
        lat: number;
        lon: number;
    };
    zoomLevel: number;
    mapDivId: string;
    load: () => Promise<void>;
    addFeature: (symbolGeoJSON: any) => void;
    removeFeature: (poid: string) => void;
    addPoly: (coords: Array<{
        lat: number;
        lon: number;
    }>, color?: string, weight?: number) => void;
    getBounds: () => any;
    displayInfo: (content: string, location: {
        lat: number;
        lon: number;
    }, handlers?: Array<{
        selector: string;
        handler: (e: Event) => void;
        closeInfo?: boolean;
    }>) => void;
    clearInk: () => void;
}

declare class LeafletMap implements IMapAdapter {
    onStrokeStart?: (location: {
        lat: number;
        lon: number;
    }, timestamp: string) => void;
    onStrokeCompleted?: (pixelBoundsWindow: {
        width: number;
        height: number;
    }, topLeftGeoMap: {
        lat: number;
        lon: number;
    }, bottomRightGeoMap: {
        lat: number;
        lon: number;
    }, strokePoints: Array<{
        lat: number;
        lon: number;
    }>, timeStrokeStart: string, timeStrokeEnd: string, intersectedPoids: string[]) => void;
    onSelection?: (symbol: any) => void;
    apiKey: string;
    mapCenter: {
        lat: number;
        lon: number;
    };
    zoomLevel: number;
    mapDivId: string;
    private mapRef;
    private strokeStart;
    private strokeEnd;
    private strokePoly;
    private moveListener;
    private assets;
    constructor(apiKey: string, mapDivId: string, mapCenter: {
        lat: number;
        lon: number;
    }, zoomLevel: number);
    load: () => Promise<void>;
    drawFreeHand: (latLng: any) => void;
    enableDrawing: () => void;
    enableDragZoom: () => void;
    addFeature: (symbolGeoJSON: any) => void;
    removeFeature: (poid: string) => void;
    addPoly: (coords: Array<{
        lat: number;
        lon: number;
    }>, color?: string, weight?: number) => void;
    getBounds: () => any;
    displayInfo: (content: string, location: {
        lat: number;
        lon: number;
    }, handlers?: Array<{
        selector: string;
        handler: (e: Event) => void;
        closeInfo?: boolean;
    }>) => void;
    clearInk: () => void;
    getIsoTimestamp: () => string;
}

export { LeafletMap };
