import { LatLon } from 'sketch-thru-plan-sdk';
export class BasicRenderer {
    constructor(symbol, pointSize = 50) {
        this.symbol = symbol;
        this.size = pointSize;
    }
    asGeoJSON() {
        let res = this.symbol.asGeoJSON();
        let gesture = this.getGestureGeometry(this.symbol);
        res.geometry = gesture;
        let svgRendering = this.asSVG();
        if (svgRendering) {
            res.properties.rendering = svgRendering;
        }
        return res;
    }
    asSVG() {
        if (this.symbol.location?.fsTYPE == 'point') {
            let gsvg = [this.pointSVG(this.symbol)];
            return gsvg;
        }
        else {
            return null;
        }
    }
    getGestureGeometry(symbol) {
        if (symbol.location == undefined || symbol.location == null || symbol.location.coords == undefined || symbol.location.coords.length == 0 || symbol.location.centroid == undefined) {
            throw new Error('Symbol does not have location information');
        }
        let res;
        let geoType;
        let geoCoordinates;
        if (symbol.location.shape == "point") {
            res = {
                type: "Point",
                coordinates: [symbol.location.centroid.lon, symbol.location.centroid.lat]
            };
        }
        else {
            res = this.toLineString(symbol.location.coords);
            if (symbol.location?.shape != null && symbol.location?.shape.includes("arrowfat")) {
                let reorderedLatLon = symbol.location.coords.slice(0, symbol.location.coords.length - 1).reverse();
                reorderedLatLon.push(symbol.location.coords[symbol.location.coords.length - 1]);
                res = this.toLineString(reorderedLatLon);
            }
            else if (symbol.location?.shape == "ubend") {
                let reorderedLatLon = [symbol.location.coords[0], symbol.location.coords[2], symbol.location.coords[3], symbol.location.coords[1]];
                res = this.toLineString(reorderedLatLon);
            }
            else if (symbol.location?.shape == "ubendthreepoints") {
                let fourthPt = new LatLon(symbol.location.coords[1].lat, symbol.location.coords[2].lon);
                let reorderedLatLon = [symbol.location.coords[0], symbol.location.coords[2], fourthPt, symbol.location.coords[1]];
                res = this.toLineString(reorderedLatLon);
            }
            else if (symbol.location?.shape == "vee") {
                let reorderedLatLon = [symbol.location.coords[1], symbol.location.coords[0], symbol.location.coords[2]];
                res = this.toLineString(reorderedLatLon);
            }
            else if (symbol.location?.shape == "opencircle") {
            }
            else if (symbol.location?.shape == "multipoint") {
                res = {
                    type: "MultiPoint",
                    coordinates: symbol.location.coords.map((item) => [item.lon, item.lat])
                };
            }
        }
        return res;
    }
    pointSVG(symbol) {
        if (symbol.location == undefined || symbol.location == null || symbol.location.centroid == undefined) {
            throw new Error('Point symbol does not have a defined centroid');
        }
        let command;
        let properties;
        let fillColor;
        let width;
        let height;
        let strokeColor = "black";
        let strokeWidth = 1;
        let rotation = 0;
        let transform = '';
        const scaling = 1.42;
        if (symbol.affiliation === "friend") {
            width = this.size - 2 * strokeWidth;
            height = this.size / scaling - 2 * strokeWidth;
            command = 'rect';
            properties = 'width="' + width + '" ' +
                'height="' + height + '" ';
            fillColor = "#80e0ff";
        }
        else if (symbol.affiliation === "hostile") {
            let side = this.size / scaling - 2 * strokeWidth;
            width = height = side * Math.SQRT2;
            command = 'rect';
            properties = 'width="' + side + '" ' +
                'height="' + side + '" ';
            fillColor = "#ff8080";
            rotation = 45;
            transform = 'transform="translate(' + width / 2 + ' 0) rotate(' + rotation + ')" ';
        }
        else if (symbol.affiliation === "neutral") {
            width = height = this.size / scaling - 2 * strokeWidth;
            command = 'rect';
            properties = 'width="' + width + '" ' +
                'height="' + height + '" ';
            fillColor = "#aaffaa";
        }
        else {
            width = height = this.size / scaling - 2 * strokeWidth;
            command = 'circle';
            properties = 'cx="' + width / 2 + '" ' +
                'cy="' + height / 2 + '" ' +
                'r="' + width / 2 + '" ';
            fillColor = "#ffff80";
        }
        let svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" ' +
            'width="' + width + '" ' +
            'height="' + height + '" ' +
            'viewBox="0 0 ' + width + ' ' + height + '" ' +
            '> ' +
            '<' + command + ' ' + properties + ' ' +
            'stroke="' + strokeColor + '" ' +
            'stoke-width="' + strokeWidth + '" ' +
            'fill="' + fillColor + '" ' +
            transform +
            '/>' +
            '</svg>';
        let shape;
        if (rotation > 0) {
            const matrix = this.getTransform(svg, command);
            shape = [
                this.applyTransform(matrix, { x: 0, y: 0 }),
                this.applyTransform(matrix, { x: width, y: 0 }),
                this.applyTransform(matrix, { x: width, y: height }),
                this.applyTransform(matrix, { x: 0, y: height }),
            ];
        }
        else {
            shape = [
                { x: 0, y: 0 },
                { x: width, y: 0 },
                { x: width, y: height },
                { x: 0, y: height },
            ];
        }
        let res = {
            type: 'icon',
            title: symbol.description,
            topLeft: symbol.location.centroid,
            bottomRight: symbol.location.centroid,
            position: symbol.location.centroid,
            svg: btoa(svg),
            shape: shape,
            anchor: { x: width / 2, y: height / 2 }
        };
        return res;
    }
    getTransform(svg, selector) {
        let tempDiv = document.createElement('div');
        document.body.appendChild(tempDiv);
        tempDiv.setAttribute('style', "position:absolute; padding:0; margin:0;visibility:hidden; width:0; height:0");
        tempDiv.insertAdjacentHTML('beforeend', svg);
        let svgEl = tempDiv.querySelector(selector);
        let matrix = svgEl?.getCTM();
        document.body.removeChild(tempDiv);
        if (matrix) {
            return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
        }
        else {
            return [1, 0, 0, 1, 0, 0];
        }
    }
    toLineString(coords) {
        let res = {
            type: "LineString",
            coordinates: coords.map((item) => [item.lon, item.lat])
        };
        return res;
    }
    applyTransform(m, point) {
        return { x: point.x * m[0] + point.y * m[2] + m[4], y: point.x * m[1] + point.y * m[3] + m[5] };
    }
}
//# sourceMappingURL=basicrenderer.js.map