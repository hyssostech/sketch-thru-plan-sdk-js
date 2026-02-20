import { IStpRenderer } from '../../interfaces/IStpRenderer';
declare global {
    interface Window {
        WebRenderer?: any;
        milSymTS?: any;
        JmsRenderer?: any;
    }
}
interface LatLonLike {
    lat?: number;
    lon?: number;
    x?: number;
    y?: number;
}
interface BoundsLike {
    east?: number;
    west?: number;
    north?: number;
    south?: number;
}
interface LocationLike {
    shape?: string;
    coords?: LatLonLike[];
    centroid?: LatLonLike;
}
interface SidcLike {
    legacy?: string;
    partA?: string;
    partB?: string;
    symbolSet?: string;
}
interface SymbolLike {
    poid?: string;
    fsTYPE?: string;
    sidc?: SidcLike;
    affiliation?: string;
    parent?: string;
    designator1?: string;
    designator2?: string;
    status?: string;
    modifier?: string;
    strength?: string;
    timeFrom?: string;
    timeTo?: string;
    altitude?: number;
    minAltitude?: number;
    maxAltitude?: number;
    fullDescription?: string;
    location?: LocationLike;
}
export declare class MilsymTsRenderer implements IStpRenderer {
    private symbol;
    private bounds?;
    constructor(symbol: SymbolLike, bounds?: BoundsLike);
    asGeoJSON(): any;
    asSVG(): Array<any> | null;
}
export {};
