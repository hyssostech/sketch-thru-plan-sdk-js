/// <reference types="google.maps" />
import { LatLon, Size, StpSymbol } from "sketch-thru-plan-sdk";
type InfoHandlers = {
    selector: string;
    handler: (event: Event) => void;
    closeInfo: boolean;
};
interface IStpMap {
    addFeature(symbolGeoJSON: GeoJSON.Feature): void;
    removeFeature(poid: string): void;
    clearInk(): void;
    getBounds(): google.maps.LatLngBounds;
    displayInfo(content: string, location: LatLon, handlers: InfoHandlers[]): void;
    onStrokeStart: ((location: LatLon, timestamp: string) => void) | undefined;
    onStrokeCompleted: ((pixelBoundsWindow: Size, topLeftGeoMap: LatLon, bottomRightGeoMap: LatLon, strokePoints: LatLon[], timeStrokeStart: string, timeStrokeEnd: string, intersectedPoids: string[]) => void) | undefined;
    onSelection: ((symbol: StpSymbol) => void) | undefined;
}
export declare class GoogleMap implements IStpMap {
    onStrokeStart: ((location: LatLon, timestamp: string) => void) | undefined;
    onStrokeCompleted: ((pixelBoundsWindow: Size, topLeftGeoMap: LatLon, bottomRightGeoMap: LatLon, strokePoints: LatLon[], timeStrokeStart: string, timeStrokeEnd: string, intersectedPoids: string[]) => void) | undefined;
    onSelection: ((symbol: StpSymbol) => void) | undefined;
    apiKey: string;
    mapDivId: string;
    map: google.maps.Map | undefined;
    mapCenter: LatLon;
    zoomLevel: number;
    strokeStart: string;
    strokeEnd: string;
    strokePoly: google.maps.Polyline | undefined;
    moveListener: google.maps.MapsEventListener | undefined;
    assets: Map<string, Array<google.maps.marker.AdvancedMarkerElement>>;
    constructor(apiKey: string, mapDivId: string, mapCenter: LatLon, zoomLevel: number);
    load: () => Promise<void>;
    initMap(): Promise<void>;
    private drawFreeHand;
    private enableDrawing;
    private enableDragZoom;
    addFeature(symbolGeoJSON: GeoJSON.Feature): void;
    removeFeature(poid: string): void;
    displayInfo(content: string, location: LatLon, handlers: {
        selector: string;
        handler: (event: Event) => void;
        closeInfo: boolean;
    }[]): void;
    clearInk(): void;
    getBounds(): google.maps.LatLngBounds;
    getIsoTimestamp(): string;
}
export {};
