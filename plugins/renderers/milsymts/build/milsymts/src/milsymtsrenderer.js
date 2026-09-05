/*
 * MilsymTsRenderer: side-by-side multipoint renderer using mil-sym-ts WebRenderer when available.
 * Fallback to existing JmsRenderer for points and when WebRenderer is not present.
 */
import * as MilSymTsWeb from '@armyc2.c5isr.renderer/mil-sym-ts-web';
// Attach imported WebRenderer to browser global if present
const ImportedWR = MilSymTsWeb === null || MilSymTsWeb === void 0 ? void 0 : MilSymTsWeb.WebRenderer;
if (typeof window !== 'undefined' && ImportedWR) {
    window.WebRenderer = window.WebRenderer || ImportedWR;
    window.milSymTS = window.milSymTS || { WebRenderer: ImportedWR };
}
function toPosition(ll) { var _a, _b, _c, _d; const lon = ((_b = (_a = ll.lon) !== null && _a !== void 0 ? _a : ll.x) !== null && _b !== void 0 ? _b : 0); const lat = ((_d = (_c = ll.lat) !== null && _c !== void 0 ? _c : ll.y) !== null && _d !== void 0 ? _d : 0); return [lon, lat]; }
function closeRing(coords) { if (coords.length > 0) {
    const f = coords[0], l = coords[coords.length - 1];
    if (f[0] !== l[0] || f[1] !== l[1])
        coords.push([...f]);
} return coords; }
function symbolProps(symbol) { var _a, _b; return { poid: symbol.poid, sidc: (_b = (_a = symbol.sidc) === null || _a === void 0 ? void 0 : _a.legacy) !== null && _b !== void 0 ? _b : symbol.sidc, fullDescription: symbol.fullDescription, fsTYPE: symbol.fsTYPE, affiliation: symbol.affiliation, status: symbol.status }; }
function renderWithWebRenderer(symbol, bounds) {
    var _a;
    try {
        const WR = window.WebRenderer || ((_a = window.milSymTS) === null || _a === void 0 ? void 0 : _a.WebRenderer);
        if (!WR)
            return null;
        const wr = new WR();
        if (typeof wr.renderGeoJSON === 'function') {
            return wr.renderGeoJSON(symbol, bounds);
        }
        if (typeof wr.render === 'function') {
            const result = wr.render(symbol, bounds);
            if (result && Array.isArray(result.paths)) {
                const features = [];
                for (const p of result.paths) {
                    const coords = Array.isArray(p.points) ? p.points.map((pt) => { var _a, _b; return toPosition({ lon: (_a = pt.lon) !== null && _a !== void 0 ? _a : pt.x, lat: (_b = pt.lat) !== null && _b !== void 0 ? _b : pt.y }); }) : [];
                    const isClosed = p.closed === true || (coords.length > 2 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]);
                    if (isClosed)
                        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closeRing(coords)] }, properties: symbolProps(symbol) });
                    else
                        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: symbolProps(symbol) });
                }
                return { type: 'FeatureCollection', features };
            }
        }
    }
    catch { /* ignore */ }
    return null;
}
export class MilsymTsRenderer {
    constructor(symbol, bounds) { this.symbol = symbol; this.bounds = bounds; }
    asGeoJSON() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const shape = (_b = (_a = this.symbol) === null || _a === void 0 ? void 0 : _a.location) === null || _b === void 0 ? void 0 : _b.shape;
        const props = symbolProps(this.symbol);
        // Handle point shapes without any dependency on JmsRenderer
        if (!shape || shape === 'point') {
            const centroid = ((_d = (_c = this.symbol) === null || _c === void 0 ? void 0 : _c.location) === null || _d === void 0 ? void 0 : _d.centroid) || ((_g = (_f = (_e = this.symbol) === null || _e === void 0 ? void 0 : _e.location) === null || _f === void 0 ? void 0 : _f.coords) === null || _g === void 0 ? void 0 : _g[0]);
            if (!centroid)
                return { type: 'FeatureCollection', features: [] };
            const pt = { type: 'Feature', geometry: { type: 'Point', coordinates: toPosition(centroid) }, properties: props };
            return { type: 'FeatureCollection', features: [pt] };
        }
        // Try mil-sym-ts WebRenderer for multipoints first
        const webGJ = renderWithWebRenderer(this.symbol, this.bounds);
        if (webGJ)
            return webGJ;
        // Fallback: shallow conversion from coords
        const coords = ((_k = (_j = (_h = this.symbol) === null || _h === void 0 ? void 0 : _h.location) === null || _j === void 0 ? void 0 : _j.coords) !== null && _k !== void 0 ? _k : []).map(toPosition);
        let feature;
        switch (shape) {
            case 'polyline':
            case 'line':
                feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: props };
                break;
            case 'polygon':
            case 'area':
            case 'rectangle':
            case 'ellipse':
                feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [closeRing(coords)] }, properties: props };
                break;
            default:
                feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: props };
                break;
        }
        return { type: 'FeatureCollection', features: [feature] };
    }
    // Optional SVG rendering not supported in this implementation
    asSVG() {
        return null;
    }
}
// Expose globally for iife bundles
;
window.MilsymTsRenderer = MilsymTsRenderer;
