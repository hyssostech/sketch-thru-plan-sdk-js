/**
 * Military symbology renderer - uses spatialillusions/milsymbol to render single point symbols,
 * missioncommand/mil-sym-js for multipoint
 */
import './mil-sym-js.js';
import { IStpRenderer } from '../../interfaces/IStpRenderer';
export declare enum RenderFormat {
    formatKML = 0,
    formatGeoJSON = 2,
    formatGeoCanvas = 3,
    formatGeoSVG = 6
}
export declare class JmsRenderer implements IStpRenderer {
    symbol: any;
    mapBounds: any;
    size: number;
    /**
     * @param symbol STP symbol to render
     * @param mapBounds Map bounds object (Google Maps or Leaflet compatible)
     * @param pointSize Size in pixels of Point symbols (units, equipment, mootw, point TG)
     */
    constructor(symbol: any, mapBounds: any, pointSize?: number);
    /** Symbol rendering as GeoJSON */
    asGeoJSON(): any;
    /** Symbol rendering as SVG, if available */
    asSVG(): Array<any> | null;
    /** Build the GeoJSON representation of a multipoint symbol */
    multipointGeoJSON(): any;
    /** Render a multipoint symbol using the missioncommand/mil-sym-js renderer */
    renderMP(format: RenderFormat): any;
    /** Build the GeoJSON representation of a single point symbol */
    pointGeoJSON(): any;
    /** Generate SVG rendering for point symbols */
    pointSVG(): any;
    /** Build an SVG representation, anchor point and clickable area points of TG labels */
    getSvgLabelAndAnchorPts(feature: any): {
        svg: string;
        anchor: {
            x: number;
            y: number;
        };
        shape: Array<{
            x: number;
            y: number;
        }>;
    };
    /** Set svg width, height, rotation based on size of contained textual label */
    placeSvgLabel(labelSvg: string, angle: number, xAlign: 'left' | 'center' | 'right', yAlign: 'top' | 'center' | 'bottom'): {
        svg: string;
        anchor: {
            x: number;
            y: number;
        };
        shape: Array<{
            x: number;
            y: number;
        }>;
    };
    /** Calculates the bounds of an SVG text element */
    getTransformedBounds(el: SVGTextElement): {
        minCx: number;
        minCy: number;
        maxCx: number;
        maxCy: number;
    };
    /** Get transformed bounding box points of an SVG text element */
    getTransformedPts(el: SVGTextElement): Array<{
        x: number;
        y: number;
    }>;
    /** Apply transform matrix to x,y point coordinates */
    applyTransform(m: DOMMatrix, x: number, y: number): {
        x: number;
        y: number;
    };
}
