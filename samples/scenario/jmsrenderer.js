/**
 * Military symbology renderer - uses spatialillusions/milsymbol to render single point symbols, missioncommand/mil-symb-js for multipoint 
 */

/**
 * missioncommand/mil-symb-js formats
 */
RenderFormat = { formatGeoJSON:2, formatGeoSVG:6, formatKML:0, formatGeoCanvas:3 }

class JmsRenderer {
    symbol;
    mapBounds;
    size;

    /**
     * 
     * @param symbol STP symbol to render
     * @param pointSize Size in pixels of Point symbols (units, equipment, mootw, point TG)
     */
    constructor(symbol, mapBounds, pointSize = 50) {
        this.symbol = symbol;
        this.mapBounds = mapBounds;
        this.size = pointSize;
    }
    //#region Main rendering methods
    /**
     * Symbol rendering as GeoJSON
     */
    asGeoJSON() {
        // Sanity check
        if (this.symbol.location == undefined || this.symbol.location == null || this.symbol.location.coords == undefined || this.symbol.location.coords.length == 0 || this.symbol.location.centroid == undefined) {
            throw new Error('Symbol does not have location information');
        }
        let res;
        if (this.symbol.location?.fsTYPE == 'point') {
            res = this.pointGeoJSON();
        }
        else {
            res = this.multipointGeoJSON();
        }
        return res;
    }

    /**
     * Symbol rendering as SVG, if available
     */
    asSVG() {
        // Sanity check
        if (this.symbol.location == undefined || this.symbol.location == null || this.symbol.location.coords == undefined || this.symbol.location.coords.length == 0 || this.symbol.location.centroid == undefined) {
            throw new Error('Symbol does not have location information');
        }
        if (this.symbol.location?.fsTYPE == 'point') {
            let gsvg = [ this.pointSVG(this.symbol) ];
            return gsvg;
        }
        else {
            // SVG representation for multipoint - these are alternatives to the GeoJSON representation, and may be useful if using SVG layers for all rendering
            // Notice that additional care is required to keep these symbols anchored to the appropriate geo locations as maps are zoomed, panned
            let gsvg = this.renderMP(RenderFormat.formatGeoSVG);
            return gsvg;
        }
    }
    //#endregion

    //#region Multipoint rendering
    /**
     * Build the GeoJSON representation of a multipoint symbol
     */
    multipointGeoJSON() {
        // Get generic symbol GeoJSON placeholder - this will be decorated with actual rendering below
        let res = this.symbol.asGeoJSON();
        
        // Convert line, area TG coords to mil-sym-js's - [lon,lat lon,lat ...]
        let rend = this.renderMP(RenderFormat.formatGeoJSON);
        let json = JSON.parse(rend);
        // RenderSymbol returns a FeatureCollection where labels/decorations are linked to Point features, and the actual tg is usually a MultiLineString feature
        // Here we convert the labels into pre-rendered SVG stored as a 'rendering' property of a single feature that represents the symbol
        if (json.features?.length > 0 ) {
            // Convert labels (point features) into SVG
            let tgGeometry = [];
            let rendering = [];
            for (let i=0; i < json.features.length; i++) {
                if (json.features[i].geometry.type == 'Point') {
                    // This is a label location
                    let position = {lat: json.features[i].geometry.coordinates[1], lon: json.features[i].geometry.coordinates[0]};
                    // Build textual svg for the label and get control points
                    let placedLabel = this.getSvgLabelAndAnchorPts(json.features[i]);
                    //let shape = [].concat.apply([], placedLabel.shape.map(item => { return [item.x, item.y];}));
                    let shape = placedLabel.shape.map(item => { return [item.x, item.y];}).flat();
                    // Pack the rendering parameters
                    let res =  {
                        type: 'label',
                        position: position,
                        svg: btoa(placedLabel.svg),
                        shape: shape,
                        anchor: placedLabel.anchor,
                        properties: json.features[i].properties
                    };
                    rendering.push(res);
                }
                else {
                    // Save the non-label geometry 
                    tgGeometry.push(json.features[i].geometry);
                }
            }
            // Save into  GeoJSON so it can be rendered in feature style
            res.properties.rendering = rendering;
            // Replace the simplistic symbol geometry based on the anchor points with the multiline geometry produced by the renderer
            if (tgGeometry.length == 1) {
                // Add single geometry directly
                res.geometry = tgGeometry[0];
            }
            else if (tgGeometry.length > 1) {
                // Wrap into a GeometryCollection
                res.geometry = {
                    type: 'GeometryCollection',
                    geometries: tgGeometry
                };
            }
            else {
                // TODO: improved logging
                Console.log('No geometry found in rendered geojson');
            }
        }
        return res;
    }

    /**
     * Render a multipoint symbol using the missioncommand/mil-sym-js renderer
     * @param {RenderFormat} format 
     */
    renderMP(format) {
        // mil-sym-js shortcuts
        let mtg = armyc2.c2sd.renderer.utilities.ModifiersTG;
        let swr = sec.web.renderer.SECWebRenderer;
        // Convert symbol anchor points
        let tgLatLng = this.symbol.location.coords.map(item => { return item.lon.toString() + ',' + item.lat.toString(); }).join(' ');
        // BBox: "left" (W), "bottom" (S), "right" (E), "top" (N)
        let bbox = this.mapBounds.getSouthWest().lng().toString() + ',' + this.mapBounds.getSouthWest().lat().toString() + ',' +
            this.mapBounds.getNorthEast().lng().toString() + ',' + this.mapBounds.getNorthEast().lat().toString();
        let modifiers = {};
        if (this.symbol.designator1) {
            modifiers[mtg.T_UNIQUE_DESIGNATION_1] = this.symbol.designator1;
        }
        if (this.symbol.designator2) {
            modifiers[mtg.T_UNIQUE_DESIGNATION_2] = this.symbol.designator2;
        }
        let scale = 1; // Recalculated internally based on BBounds - sec.web.renderer.
        swr.setDefaultSymbologyStandard(1); // 2525C
        return swr.RenderSymbol(this.symbol.poid, this.symbol.shortDescription,this.symbol.fullDescription, this.symbol.sidc.legacy, tgLatLng, "clampToGround", scale, bbox, modifiers, format);
    }
    //#endregion

    //#region Point rendering
    
    /**
     * Build the GeoJSON representation of a single point symbol
     */
    pointGeoJSON() {
        // Load the simple JSON representation that is provided by the SDK itself, which represents just the anchor points
        let res =  this.symbol.asGeoJSON();

        // Add SVG rendering for single point symbols - these are used to identify symbols that would otherwise just show as single points on the map
        let svgRendering = this.asSVG();
        if (svgRendering) {
            res.properties.rendering = svgRendering;
        }
        return res;
    }

    /**
     * Generate SVG rendering for point symbols (units, mootw, equipment, single point TG)
     */
    pointSVG()
    {
        let res = null;
        // Load renderer options
        let renderOptions = {};
        if (this.symbol.parent) {
            renderOptions.higherFormation = this.symbol.parent;
        }
        if (this.symbol.fsTYPE === 'equipment' && this.symbol.affiliation === 'hostile') {
            renderOptions.hostile = 'ENY';
        }
        if (this.symbol.strength) {
            if (this.symbol.strength === 'reinforced') {
            renderOptions.reinforcedReduced = '+';
            } else if (this.symbol.strength === 'reduced') {
                renderOptions.reinforcedReduced = '-';
            } else if (this.symbol.strength === 'reduced_reinforced') {
                renderOptions.reinforcedReduced = '+-';
            }
        }
        if (this.symbol.designator1) {
            renderOptions.uniqueDesignation = this.symbol.designator1;
        }
        if (this.symbol.altitude) {
            renderOptions.altitudeDepth = this.symbol.altitude.toString();
        }
        renderOptions.size = 30;
        // Render to svg
        let symbolRenderer = new ms.Symbol(this.symbol.sidc.legacy, renderOptions);
        let symbolSvg = symbolRenderer.asSVG();
        if (symbolSvg) {
            let anchor = symbolRenderer.getAnchor();
            // Clickable region - needs to be adjusted particularly for hostile symbols, which are rotated
            let shape = [
                {x:anchor.x - renderOptions.size / 2, y:anchor.y - renderOptions.size / 2},
                {x:anchor.x + renderOptions.size / 2, y:anchor.y - renderOptions.size / 2},
                {x:anchor.x + renderOptions.size / 2, y:anchor.y + renderOptions.size / 2},
                {x:anchor.x - renderOptions.size / 2, y:anchor.y + renderOptions.size / 2},
            ];
            // Pack the rendering parameters
            res =  {
                type: 'icon',
                title: this.symbol.description,
                position: this.symbol.location.centroid,
                svg: btoa(symbolSvg),
                shape: shape,
                anchor: anchor
            };
        }
        return res;
    }

    /**
     * Build an SVG representation, anchor point and clickable area points of TG labels
     * @param {GeoJSON.Feature} feature 
     * @returns {svg, anchor, shape}
     */
    getSvgLabelAndAnchorPts(feature) {
        // Build svg based on the provided feature properties
        let labelSvg = 
        '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" >' + //style="border:1px solid black" >' +
            '<text xml:space="preserve" x="0" y="0" ' +
                'dominant-baseline="hanging" text-anchor="start" ' + // Actual alignment done via transformations
                'style="font-size:' + feature.properties.fontSize + ';' + 
                    'font-family:' + feature.properties.fontFamily + ';' + 
                    'font-style:normal;' +
                    'font-weight:' + feature.properties.fontWeight + ';' + 
                    'paint-order:stroke;' +
                    'fill:' + feature.properties.fontColor + ';' +
                    'fill-opacity:1;' +
                    'stroke:' + feature.properties.labelOutlineColor + ';' +
                    'stroke-width:' + feature.properties.labelOutlineWidth + ';' +
                    'stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;">' + 
                        feature.properties.label + 
            '</text>' +
        '</svg>';
        // Set the size of the svg element and its rotation based on the size of the contained text and desired alignment
        let xAlign = feature.properties.labelAlign;
        let yAlign = xAlign !== "center" ? "bottom" : "top";
        return this.placeSvgLabel(labelSvg, parseFloat(feature.properties.angle), xAlign, yAlign);
    }

    /**
     * Set svg width, height, rotation based on size of contained textual label
     * @param {string} labelSvg - svg to patch, as a string
     * @returns Patched svg string, anchor point, shape points - points around the label itself
     */
    placeSvgLabel(labelSvg, angle, xAlign, yAlign) {
        // Create hidden div to house the element being measured
        let tempDiv = document.createElement('div')
        document.body.appendChild(tempDiv);
        // Change visibility _after_ adding to document, otherwise getCMT() will return null
        tempDiv.setAttribute('style', "position:absolute; padding:0; margin:0;visibility:hidden; width:0; height:0")
        // Child svg - set to the parameter contents
        tempDiv.insertAdjacentHTML( 'beforeend', labelSvg )
        let svgEl = tempDiv.querySelector('svg')
        let textEl = svgEl.querySelector('text');
        // Calculate the anchor point given the unrotated text measurements and desired alignments
        let bb = textEl.getBBox()
        let anchor = {x: 0, y:0};
        if (xAlign === 'left') anchor.x = bb.x; 
        else if (xAlign === 'center') { 
            anchor.x = (bb.x + bb.width) / 2.0;
            yAlign = 'center';
        }
        else if (xAlign === 'right')  anchor.x = bb.x + bb.width;
        if (yAlign === 'top')  anchor.y = bb.y; 
        else if (yAlign === 'center')  anchor.y = (bb.y + bb.height) / 2.0 - 2; // TODO: why the magic number?
        else if (yAlign === 'bottom')  anchor.y = bb.y + bb.height;
        // If rotated, apply attribute and adjust anchor point and viewport size
        let transform = '';
        if (angle != 0) {
            // Apply the rotation and get the transformed coordinates that result
            transform = 'rotate(' + angle.toString()  + ') ';
            textEl.setAttribute('transform', transform);
        }
        let rotatedBounds = this.getTransformedBounds(textEl);
        // Translate enough to get all points inside the viewport (non-negative coords)
        let xTrans = 0;
        let yTrans = 0;
        if (rotatedBounds.minCx < 0) xTrans = rotatedBounds.minCx * -1;
        if (rotatedBounds.minCy < 0) yTrans = rotatedBounds.minCy * -1;
        if (xTrans > 0 || yTrans > 0) {
            // Add translation to the left so that rotation, if present is performed first - order is right to left
            transform = 'translate(' + xTrans.toString() + ',' + yTrans.toString() + ') ' + transform;
            textEl.setAttribute('transform', transform);
        }
        let transBounds = this.getTransformedBounds(textEl);
        // Set a viewport width and height enough to fit the element even if rotated
        let width = Math.abs(transBounds.maxCx - rotatedBounds.minCx);
        let height = Math.abs(transBounds.maxCy - rotatedBounds.minCy);
        svgEl.setAttribute('width', width.toString());
        svgEl.setAttribute('height', height.toString());
        // Set view box to the same dimensions to keep 1:1 scale wrt the viewport
        svgEl.setAttribute('viewBox', '0 0 ' + width.toString() + ' ' + height.toString());
        // Apply the same transform to the anchor point so it is aligned with the new positions of the text corners
        let m = textEl.getCTM();
        anchor = this.applyTransform(m,anchor.x,anchor.y);
        // Save the patched svg string
        let svgString = svgEl.outerHTML;
        // Get the points around the shape - potentially rotated rectangle wrapped around the label
        let shapePts = this.getTransformedPts(textEl);
        // Cleanup
        document.body.removeChild(tempDiv)
        return {svg: svgString, anchor: anchor, shape: shapePts} ;
    }

    /**
     * Calculates the bounds of an SVG text element
     * @param {SVGTextElement} el 
     * @returns {minCx:, minCy, maxCx:, maxCy}
     */
    getTransformedBounds(el) {
    var pts = this.getTransformedPts(el);
    let bounds = {
        minCx: pts.reduce((min, p) => p.x < min ? p.x : min, pts[0].x),
        minCy: pts.reduce((min, p) => p.y < min ? p.y : min, pts[0].y),
        maxCx: pts.reduce((max, p) => p.x > max ? p.x : max, pts[0].x),
        maxCy: pts.reduce((max, p) => p.y > max ? p.y : max, pts[0].y)
    };
    return bounds;
    } 

    /**
     * Get transformed bounding box of an SVG text element
     * @param {SVGTextElement} el 
     * @returns bounding box transformed according to the elements transform
     */
    getTransformedPts( el ) {
        var m = el.getCTM();
        var bb = el.getBBox();
        var tpts = [
            this.applyTransform(m,bb.x,bb.y),
            this.applyTransform(m,bb.x+bb.width,bb.y),
            this.applyTransform(m,bb.x+bb.width,bb.y+bb.height),
            this.applyTransform(m,bb.x,bb.y+bb.height) ]
        // top left, top right, bottom left, bottom right
        return tpts;
    }

    /**
     * Apply transform matrix to x,y point coordinates
     * @param {DOMMatrix} m 
     * @param {number} x 
     * @param {number} y 
     */
    applyTransform(m,x,y) {
        return { x: x * m.a + y * m.c + m.e, y: x * m.b + y * m.d + m.f };
    }
    //#endregion
}
