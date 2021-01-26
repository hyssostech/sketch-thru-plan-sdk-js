import { StpSymbol, LatLon } from 'sketch-thru-plan-sdk';
export interface IStpRenderer {
    asGeoJSON(): GeoJSON.Feature<any>;
    asSVG(): IGeoSvg[] | null;
}
export interface IPoint {
    x: number;
    y: number;
}
export interface IGeoSvg {
    type: 'icon' | 'label' | 'tg';
    title?: string;
    topLeft: LatLon;
    bottomRight: LatLon;
    position: LatLon;
    svg: string;
    shape: IPoint[];
    anchor: IPoint;
    properties?: {
        [name: string]: any;
    } | null;
}
export declare class BasicRenderer implements IStpRenderer {
    symbol: StpSymbol;
    size: number;
    constructor(symbol: StpSymbol, pointSize?: number);
    asGeoJSON(): GeoJSON.Feature<any>;
    asSVG(): IGeoSvg[] | null;
    private getGestureGeometry;
    private pointSVG;
    private getTransform;
    private toLineString;
    private applyTransform;
}
