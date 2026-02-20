/**
 * Military symbology renderer - uses spatialillusions/milsymbol to render single point symbols,
 * missioncommand/mil-sym-js for multipoint
 */
// Ensure legacy mil-sym-js is bundled as a side-effect (defines global `sec`)
import './mil-sym-js.js';
import * as ms from 'milsymbol';
export var RenderFormat;
(function (RenderFormat) {
    RenderFormat[RenderFormat["formatKML"] = 0] = "formatKML";
    RenderFormat[RenderFormat["formatGeoJSON"] = 2] = "formatGeoJSON";
    RenderFormat[RenderFormat["formatGeoCanvas"] = 3] = "formatGeoCanvas";
    RenderFormat[RenderFormat["formatGeoSVG"] = 6] = "formatGeoSVG";
})(RenderFormat || (RenderFormat = {}));
export class JmsRenderer {
    /**
     * @param symbol STP symbol to render
     * @param mapBounds Map bounds object (Google Maps or Leaflet compatible)
     * @param pointSize Size in pixels of Point symbols (units, equipment, mootw, point TG)
     */
    constructor(symbol, mapBounds, pointSize = 50) {
        this.symbol = symbol;
        this.mapBounds = mapBounds;
        this.size = pointSize;
    }
    /** Symbol rendering as GeoJSON */
    asGeoJSON() {
        var _a, _b, _c, _d;
        if (!((_a = this.symbol) === null || _a === void 0 ? void 0 : _a.location) ||
            !((_b = this.symbol.location) === null || _b === void 0 ? void 0 : _b.coords) ||
            this.symbol.location.coords.length === 0 ||
            !((_c = this.symbol.location) === null || _c === void 0 ? void 0 : _c.centroid)) {
            throw new Error('Symbol does not have location information');
        }
        if (((_d = this.symbol.location) === null || _d === void 0 ? void 0 : _d.fsTYPE) === 'point') {
            return this.pointGeoJSON();
        }
        return this.multipointGeoJSON();
    }
    /** Symbol rendering as SVG, if available */
    asSVG() {
        var _a, _b, _c, _d;
        if (!((_a = this.symbol) === null || _a === void 0 ? void 0 : _a.location) ||
            !((_b = this.symbol.location) === null || _b === void 0 ? void 0 : _b.coords) ||
            this.symbol.location.coords.length === 0 ||
            !((_c = this.symbol.location) === null || _c === void 0 ? void 0 : _c.centroid)) {
            throw new Error('Symbol does not have location information');
        }
        if (((_d = this.symbol.location) === null || _d === void 0 ? void 0 : _d.fsTYPE) === 'point') {
            const gsvg = [this.pointSVG()];
            return gsvg;
        }
        const gsvg = this.renderMP(RenderFormat.formatGeoSVG);
        return gsvg;
    }
    /** Build the GeoJSON representation of a multipoint symbol */
    multipointGeoJSON() {
        var _a;
        const res = this.symbol.asGeoJSON();
        const rend = this.renderMP(RenderFormat.formatGeoJSON);
        const json = JSON.parse(rend);
        if (((_a = json.features) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            const tgGeometry = [];
            const rendering = [];
            for (let i = 0; i < json.features.length; i++) {
                if (json.features[i].geometry.type === 'Point') {
                    const position = {
                        lat: json.features[i].geometry.coordinates[1],
                        lon: json.features[i].geometry.coordinates[0]
                    };
                    const placedLabel = this.getSvgLabelAndAnchorPts(json.features[i]);
                    const shape = placedLabel.shape.map((item) => [item.x, item.y]).flat();
                    const pack = {
                        type: 'label',
                        position,
                        svg: btoa(placedLabel.svg),
                        shape,
                        anchor: placedLabel.anchor,
                        properties: json.features[i].properties
                    };
                    rendering.push(pack);
                }
                else {
                    tgGeometry.push(json.features[i].geometry);
                }
            }
            res.properties.rendering = rendering;
            if (tgGeometry.length === 1) {
                res.geometry = tgGeometry[0];
            }
            else if (tgGeometry.length > 1) {
                res.geometry = { type: 'GeometryCollection', geometries: tgGeometry };
            }
            else {
                console.log('No geometry found in rendered geojson');
            }
        }
        return res;
    }
    /** Render a multipoint symbol using the missioncommand/mil-sym-js renderer */
    renderMP(format) {
        const armyc2Global = window.armyc2;
        const secGlobal = window.sec;
        if (!armyc2Global || !secGlobal) {
            throw new Error('Multipoint renderer libraries not loaded (armyc2/sec)');
        }
        const mtg = armyc2Global.c2sd.renderer.utilities.ModifiersTG;
        const swr = secGlobal.web.renderer.SECWebRenderer;
        const tgLatLng = this.symbol.location.coords
            .map((item) => item.lon.toString() + ',' + item.lat.toString())
            .join(' ');
        const sw = this.mapBounds.getSouthWest ? this.mapBounds.getSouthWest() : this.mapBounds.sw;
        const ne = this.mapBounds.getNorthEast ? this.mapBounds.getNorthEast() : this.mapBounds.ne;
        const getLat = (p) => (typeof p.lat === 'function' ? p.lat() : p.lat);
        const getLng = (p) => (typeof p.lng === 'function' ? p.lng() : p.lng);
        const bbox = getLng(sw).toString() +
            ',' +
            getLat(sw).toString() +
            ',' +
            getLng(ne).toString() +
            ',' +
            getLat(ne).toString();
        const modifiers = {};
        if (this.symbol.designator1)
            modifiers[mtg.T_UNIQUE_DESIGNATION_1] = this.symbol.designator1;
        if (this.symbol.designator2)
            modifiers[mtg.T_UNIQUE_DESIGNATION_2] = this.symbol.designator2;
        const scale = 1;
        swr.setDefaultSymbologyStandard(1); // 2525C
        return swr.RenderSymbol(this.symbol.poid, this.symbol.shortDescription, this.symbol.fullDescription, this.symbol.sidc.legacy, tgLatLng, 'clampToGround', scale, bbox, modifiers, format);
    }
    /** Build the GeoJSON representation of a single point symbol */
    pointGeoJSON() {
        const res = this.symbol.asGeoJSON();
        const svgRendering = this.asSVG();
        if (svgRendering)
            res.properties.rendering = svgRendering;
        return res;
    }
    /** Generate SVG rendering for point symbols */
    pointSVG() {
        var _a;
        let res = null;
        const renderOptions = {};
        if (this.symbol.parent)
            renderOptions.higherFormation = this.symbol.parent;
        if (this.symbol.fsTYPE === 'equipment' && this.symbol.affiliation === 'hostile')
            renderOptions.hostile = 'ENY';
        if (this.symbol.strength) {
            if (this.symbol.strength === 'reinforced')
                renderOptions.reinforcedReduced = '+';
            else if (this.symbol.strength === 'reduced')
                renderOptions.reinforcedReduced = '-';
            else if (this.symbol.strength === 'reduced_reinforced')
                renderOptions.reinforcedReduced = '+-';
        }
        if (this.symbol.designator1)
            renderOptions.uniqueDesignation = this.symbol.designator1;
        if (this.symbol.altitude)
            renderOptions.altitudeDepth = this.symbol.altitude.toString();
        renderOptions.size = 30;
        const MilSymbolCtor = (ms === null || ms === void 0 ? void 0 : ms.Symbol) || ((_a = ms === null || ms === void 0 ? void 0 : ms.default) === null || _a === void 0 ? void 0 : _a.Symbol) || (ms === null || ms === void 0 ? void 0 : ms.default) || ms;
        const symbolRenderer = new MilSymbolCtor(this.symbol.sidc.legacy, renderOptions);
        const symbolSvg = symbolRenderer.asSVG();
        if (symbolSvg) {
            const anchor = symbolRenderer.getAnchor();
            const shape = [
                { x: anchor.x - renderOptions.size / 2, y: anchor.y - renderOptions.size / 2 },
                { x: anchor.x + renderOptions.size / 2, y: anchor.y - renderOptions.size / 2 },
                { x: anchor.x + renderOptions.size / 2, y: anchor.y + renderOptions.size / 2 },
                { x: anchor.x - renderOptions.size / 2, y: anchor.y + renderOptions.size / 2 }
            ];
            res = {
                type: 'icon',
                title: this.symbol.description,
                position: this.symbol.location.centroid,
                svg: btoa(symbolSvg),
                shape,
                anchor
            };
        }
        return res;
    }
    /** Build an SVG representation, anchor point and clickable area points of TG labels */
    getSvgLabelAndAnchorPts(feature) {
        const labelSvg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" >' +
            '<text xml:space="preserve" x="0" y="0" ' +
            'dominant-baseline="hanging" text-anchor="start" ' +
            'style="font-size:' +
            feature.properties.fontSize +
            ';' +
            'font-family:' +
            feature.properties.fontFamily +
            ';' +
            'font-style:normal;' +
            'font-weight:' +
            feature.properties.fontWeight +
            ';' +
            'paint-order:stroke;' +
            'fill:' +
            feature.properties.fontColor +
            ';' +
            'fill-opacity:1;' +
            'stroke:' +
            feature.properties.labelOutlineColor +
            ';' +
            'stroke-width:' +
            feature.properties.labelOutlineWidth +
            ';' +
            'stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;">' +
            feature.properties.label +
            '</text>' +
            '</svg>';
        const xAlign = feature.properties.labelAlign;
        const yAlign = xAlign !== 'center' ? 'bottom' : 'top';
        return this.placeSvgLabel(labelSvg, parseFloat(feature.properties.angle), xAlign, yAlign);
    }
    /** Set svg width, height, rotation based on size of contained textual label */
    placeSvgLabel(labelSvg, angle, xAlign, yAlign) {
        const tempDiv = document.createElement('div');
        document.body.appendChild(tempDiv);
        tempDiv.setAttribute('style', 'position:absolute; padding:0; margin:0;visibility:hidden; width:0; height:0');
        tempDiv.insertAdjacentHTML('beforeend', labelSvg);
        const svgEl = tempDiv.querySelector('svg');
        const textEl = svgEl.querySelector('text');
        const bb = textEl.getBBox();
        let anchor = { x: 0, y: 0 };
        let yAlignLocal = yAlign;
        if (xAlign === 'left')
            anchor.x = bb.x;
        else if (xAlign === 'center') {
            anchor.x = (bb.x + bb.width) / 2.0;
            yAlignLocal = 'center';
        }
        else if (xAlign === 'right')
            anchor.x = bb.x + bb.width;
        if (yAlignLocal === 'top')
            anchor.y = bb.y;
        else if (yAlignLocal === 'center')
            anchor.y = (bb.y + bb.height) / 2.0 - 2;
        else if (yAlignLocal === 'bottom')
            anchor.y = bb.y + bb.height;
        let transform = '';
        if (angle !== 0) {
            transform = 'rotate(' + angle.toString() + ') ';
            textEl.setAttribute('transform', transform);
        }
        const rotatedBounds = this.getTransformedBounds(textEl);
        let xTrans = 0;
        let yTrans = 0;
        if (rotatedBounds.minCx < 0)
            xTrans = rotatedBounds.minCx * -1;
        if (rotatedBounds.minCy < 0)
            yTrans = rotatedBounds.minCy * -1;
        if (xTrans > 0 || yTrans > 0) {
            transform = 'translate(' + xTrans.toString() + ',' + yTrans.toString() + ') ' + transform;
            textEl.setAttribute('transform', transform);
        }
        const transBounds = this.getTransformedBounds(textEl);
        const width = Math.abs(transBounds.maxCx - rotatedBounds.minCx);
        const height = Math.abs(transBounds.maxCy - rotatedBounds.minCy);
        svgEl.setAttribute('width', width.toString());
        svgEl.setAttribute('height', height.toString());
        svgEl.setAttribute('viewBox', '0 0 ' + width.toString() + ' ' + height.toString());
        const m = textEl.getCTM();
        anchor = this.applyTransform(m, anchor.x, anchor.y);
        const svgString = svgEl.outerHTML;
        const shapePts = this.getTransformedPts(textEl);
        document.body.removeChild(tempDiv);
        return { svg: svgString, anchor, shape: shapePts };
    }
    /** Calculates the bounds of an SVG text element */
    getTransformedBounds(el) {
        const pts = this.getTransformedPts(el);
        return {
            minCx: pts.reduce((min, p) => (p.x < min ? p.x : min), pts[0].x),
            minCy: pts.reduce((min, p) => (p.y < min ? p.y : min), pts[0].y),
            maxCx: pts.reduce((max, p) => (p.x > max ? p.x : max), pts[0].x),
            maxCy: pts.reduce((max, p) => (p.y > max ? p.y : max), pts[0].y)
        };
    }
    /** Get transformed bounding box points of an SVG text element */
    getTransformedPts(el) {
        const m = el.getCTM();
        const bb = el.getBBox();
        return [
            this.applyTransform(m, bb.x, bb.y),
            this.applyTransform(m, bb.x + bb.width, bb.y),
            this.applyTransform(m, bb.x + bb.width, bb.y + bb.height),
            this.applyTransform(m, bb.x, bb.y + bb.height)
        ];
    }
    /** Apply transform matrix to x,y point coordinates */
    applyTransform(m, x, y) {
        return { x: x * m.a + y * m.c + m.e, y: x * m.b + y * m.d + m.f };
    }
}
window.JmsRenderer = JmsRenderer;
