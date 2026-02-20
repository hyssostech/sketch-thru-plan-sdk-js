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

declare class ArcGISMap implements IMapAdapter {
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
    private mapRef;
    private viewRef;
    private symbolLayerPoint;
    private symbolLayerMultipoint;
    private symbolLayerLine;
    private symbolLayerPolygon;
    private inkLayer;
    private inkLayerView;
    private drawing;
    private strokeStartTs;
    private strokeGraphic;
    private assets;
    private nextObjectId;
    private milDictionaryStyleUrl;
    private milDictionaryPortalItemId;
    constructor(apiKey: string | null, mapDivId: string, mapCenter: {
        lat: number;
        lon: number;
    }, zoomLevel: number, options?: {
        mil2525StyleUrl?: string;
        mil2525PortalItemId?: string;
    });
    load: () => Promise<void>;
    addFeature: (symbolGeoJSON: any) => void;
    removeFeature: (poid: string) => Promise<void>;
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
    private getIsoTimestamp;
    private geoJSONToEsriGeometry;
    private convertExtentToWGS84;
}

export { ArcGISMap };
