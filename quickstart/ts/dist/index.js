(function (sketchThruPlanSdk) {
    'use strict';

    class BasicRenderer {
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
            var _a;
            if (((_a = this.symbol.location) === null || _a === void 0 ? void 0 : _a.fsTYPE) == 'point') {
                let gsvg = [this.pointSVG(this.symbol)];
                return gsvg;
            }
            else {
                return null;
            }
        }
        getGestureGeometry(symbol) {
            var _a, _b, _c, _d, _e, _f, _g;
            if (symbol.location == undefined || symbol.location == null || symbol.location.coords == undefined || symbol.location.coords.length == 0 || symbol.location.centroid == undefined) {
                throw new Error('Symbol does not have location information');
            }
            let res;
            if (symbol.location.shape == "point") {
                res = {
                    type: "Point",
                    coordinates: [symbol.location.centroid.lon, symbol.location.centroid.lat]
                };
            }
            else {
                res = this.toLineString(symbol.location.coords);
                if (((_a = symbol.location) === null || _a === void 0 ? void 0 : _a.shape) != null && ((_b = symbol.location) === null || _b === void 0 ? void 0 : _b.shape.includes("arrowfat"))) {
                    let reorderedLatLon = symbol.location.coords.slice(0, symbol.location.coords.length - 1).reverse();
                    reorderedLatLon.push(symbol.location.coords[symbol.location.coords.length - 1]);
                    res = this.toLineString(reorderedLatLon);
                }
                else if (((_c = symbol.location) === null || _c === void 0 ? void 0 : _c.shape) == "ubend") {
                    let reorderedLatLon = [symbol.location.coords[0], symbol.location.coords[2], symbol.location.coords[3], symbol.location.coords[1]];
                    res = this.toLineString(reorderedLatLon);
                }
                else if (((_d = symbol.location) === null || _d === void 0 ? void 0 : _d.shape) == "ubendthreepoints") {
                    let fourthPt = new sketchThruPlanSdk.LatLon(symbol.location.coords[1].lat, symbol.location.coords[2].lon);
                    let reorderedLatLon = [symbol.location.coords[0], symbol.location.coords[2], fourthPt, symbol.location.coords[1]];
                    res = this.toLineString(reorderedLatLon);
                }
                else if (((_e = symbol.location) === null || _e === void 0 ? void 0 : _e.shape) == "vee") {
                    let reorderedLatLon = [symbol.location.coords[1], symbol.location.coords[0], symbol.location.coords[2]];
                    res = this.toLineString(reorderedLatLon);
                }
                else if (((_f = symbol.location) === null || _f === void 0 ? void 0 : _f.shape) == "opencircle") ;
                else if (((_g = symbol.location) === null || _g === void 0 ? void 0 : _g.shape) == "multipoint") {
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
            let matrix = svgEl === null || svgEl === void 0 ? void 0 : svgEl.getCTM();
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

    var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    class GoogleMap {
        constructor(apiKey, mapDivId, mapCenter, zoomLevel) {
            this.apiKey = apiKey;
            this.mapDivId = mapDivId;
            this.mapCenter = mapCenter;
            this.zoomLevel = zoomLevel;
            this.strokeStart = this.strokeEnd = '';
            this.assets = new Map();
        }
        load() {
            return __awaiter(this, void 0, void 0, function* () {
                const googleMapsUrl = "https://maps.googleapis.com/maps/api/js?key=" + this.apiKey;
                if (!document.querySelectorAll('[src="' + googleMapsUrl + '"]').length) {
                    document.body.appendChild(Object.assign(document.createElement('script'), {
                        type: 'text/javascript',
                        src: googleMapsUrl,
                        onload: () => __awaiter(this, void 0, void 0, function* () { return yield this.initMap(); })
                    }));
                }
                else {
                    yield this.initMap();
                }
            });
        }
        initMap() {
            return __awaiter(this, void 0, void 0, function* () {
                const mapDiv = document.getElementById(this.mapDivId);
                if (!mapDiv) {
                    throw new Error("Html page must contain a 'map' div");
                }
                this.map = new google.maps.Map(mapDiv, {
                    zoom: this.zoomLevel,
                    center: { lat: this.mapCenter.lat, lng: this.mapCenter.lon },
                    gestureHandling: 'cooperative',
                    draggable: true,
                    draggableCursor: 'crosshair'
                });
                this.map.data.setStyle((feature) => {
                    let rend = feature.getProperty('rendering');
                    if (rend) {
                        for (let i = 0; i < rend.length; i++) {
                            let shape = rend[i].shape.map(item => { return [item.x, item.y]; }).flat();
                            let marker = new google.maps.Marker({
                                map: this.map,
                                icon: {
                                    url: 'data:image/svg+xml;charset=UTF-8;base64,' + rend[i].svg,
                                    anchor: new google.maps.Point(rend[i].anchor.x, rend[i].anchor.y)
                                },
                                shape: {
                                    type: 'poly',
                                    coords: shape
                                },
                                position: { lat: rend[i].position.lat, lng: rend[i].position.lon },
                            });
                            if (rend[i].title) {
                                marker.setTitle(rend[i].title);
                            }
                            marker.addListener("click", () => {
                                var _a;
                                (_a = this.onSelection) === null || _a === void 0 ? void 0 : _a.call(this, feature.getProperty('symbol'));
                            });
                            let poid = feature.getProperty('symbol').poid;
                            if (!this.assets.has(poid)) {
                                this.assets.set(poid, [marker]);
                            }
                            else {
                                this.assets.get(poid).push(marker);
                            }
                        }
                        return { visible: feature.getGeometry().getType() != 'Point' };
                    }
                    return { visible: true };
                });
                this.map.data.addListener('click', (event) => {
                    var _a;
                    (_a = this.onSelection) === null || _a === void 0 ? void 0 : _a.call(this, event.feature.getProperty('symbol'));
                });
                this.map.addListener('mousedown', (e) => {
                    var _a;
                    if (e.domEvent.ctrlKey) {
                        return false;
                    }
                    e.domEvent.preventDefault();
                    this.enableDrawing();
                    (_a = this.onStrokeStart) === null || _a === void 0 ? void 0 : _a.call(this, new sketchThruPlanSdk.LatLon(e.latLng.lat(), e.latLng.lng()), this.getIsoTimestamp());
                    this.drawFreeHand(e.latLng);
                });
            });
        }
        drawFreeHand(latLng) {
            this.strokeStart = this.getIsoTimestamp();
            this.clearInk();
            this.strokePoly = new google.maps.Polyline({
                map: this.map,
                clickable: false,
                strokeColor: '#8B0000',
                strokeWeight: 2,
            });
            this.strokePoly.getPath().push(latLng);
            this.moveListener = google.maps.event.addListener(this.map, 'mousemove', (e) => {
                this.strokePoly.getPath().push(e.latLng);
            });
            google.maps.event.addListenerOnce(this.map, 'mouseup', (e) => {
                this.strokeEnd = this.getIsoTimestamp();
                if (this.moveListener) {
                    google.maps.event.removeListener(this.moveListener);
                }
                this.enableDragZoom();
                let path = this.strokePoly.getPath();
                if (path.getLength() == 1)
                    path.push(path.getAt(0));
                let strokeLatLng = path.getArray().map(item => { let o = new sketchThruPlanSdk.LatLon(item.lat(), item.lng()); return o; });
                let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
                let mapBounds = this.map.getBounds();
                if (!mapBounds) {
                    throw new Error("Failed to retrieve the map bounds - unable to send ink to STP");
                }
                if (this.onStrokeCompleted) {
                    this.onStrokeCompleted(new sketchThruPlanSdk.Size(sizePixels.width, sizePixels.height), new sketchThruPlanSdk.LatLon(mapBounds.getNorthEast().lat(), mapBounds.getSouthWest().lng()), new sketchThruPlanSdk.LatLon(mapBounds.getSouthWest().lat(), mapBounds.getNorthEast().lng()), strokeLatLng, this.strokeStart, this.strokeEnd, []);
                }
            });
        }
        enableDrawing() {
            this.map.setOptions({
                draggable: false,
                zoomControl: false,
                scrollwheel: false,
                disableDoubleClickZoom: false
            });
        }
        enableDragZoom() {
            this.map.setOptions({
                draggable: true,
                zoomControl: true,
                scrollwheel: true,
                disableDoubleClickZoom: true
            });
        }
        addFeature(symbol) {
            let gj = new BasicRenderer(symbol).asGeoJSON();
            this.map.data.addGeoJson(gj);
        }
        removeFeature(poid) {
            let feature = this.map.data.getFeatureById(poid);
            if (feature) {
                if (this.assets.has(poid)) {
                    let markers = this.assets.get(poid);
                    for (let i = 0; i < markers.length; i++) {
                        markers[i].setMap(null);
                    }
                }
                this.map.data.remove(feature);
            }
        }
        displayInfo(content, location, handlers) {
            let node = document.createElement('div');
            node.innerHTML = content;
            let centroid = { lat: location.lat, lng: location.lon };
            let infoWindow = new google.maps.InfoWindow({
                content: node,
                position: centroid,
            });
            if (infoWindow && handlers && handlers.length) {
                for (let i = 0; i < handlers.length; i++) {
                    let instance = node.querySelector(handlers[i].selector);
                    if (instance && handlers[i].handler) {
                        google.maps.event.addDomListener(instance, 'click', (event) => {
                            if (handlers[i].closeInfo) {
                                infoWindow.close();
                            }
                            handlers[i].handler(event);
                        });
                    }
                }
            }
            infoWindow.open(this.map);
        }
        clearInk() {
            var _a;
            (_a = this.strokePoly) === null || _a === void 0 ? void 0 : _a.setMap(null);
        }
        getIsoTimestamp() {
            let timestamp = new Date();
            return timestamp.toISOString();
        }
    }

    var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    const azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
    const azureServiceRegion = "<Enter Azure's subscription region>";
    const azureEndPoint = null;
    const googleMapsKey = "<Enter your Google Maps API key here>";
    const defaultMapCenter = new sketchThruPlanSdk.LatLon(58.967774948, 11.196062412);
    const defaultZoomLevel = 13;
    const defaultWebSocketUrl = "ws://<STP server>:<STP port>";
    window.onload = () => start();
    let stpsdk;
    let map;
    function start() {
        return __awaiter$1(this, void 0, void 0, function* () {
            const urlParams = new URLSearchParams(window.location.search);
            const latParm = urlParams.get('lat');
            const lonParm = urlParams.get('lon');
            const mapCenter = (latParm && lonParm) ? new sketchThruPlanSdk.LatLon(parseFloat(latParm), parseFloat(lonParm)) : defaultMapCenter;
            const zoomParm = urlParams.get('zoom');
            const zoomLevel = zoomParm ? parseInt(zoomParm) : defaultZoomLevel;
            const stpParm = urlParams.get('stpurl');
            const webSocketUrl = stpParm ? stpParm : defaultWebSocketUrl;
            urlParams.get('role');
            const stpconn = new sketchThruPlanSdk.StpWebSocketsConnector(webSocketUrl);
            stpsdk = new sketchThruPlanSdk.StpRecognizer(stpconn);
            stpsdk.onSymbolAdded = (alternates, isUndo) => {
                map.addFeature(alternates[0]);
            };
            stpsdk.onSymbolModified = (poid, symbol, isUndo) => {
                map.removeFeature(poid);
                map.addFeature(symbol);
            };
            stpsdk.onSymbolDeleted = (poid, isUndo) => {
                map.removeFeature(poid);
            };
            stpsdk.onInkProcessed = () => {
                map.clearInk();
            };
            stpsdk.onSpeechRecognized = (phrases) => {
                let speech = "";
                if (phrases && phrases.length > 0) {
                    speech = phrases[0];
                }
                log(speech);
            };
            stpsdk.onStpMessage = (msg, level) => {
                log(msg, level, true);
            };
            try {
                yield stpsdk.connect("GoogleMapsSample", 10);
            }
            catch (error) {
                let msg = "Failed to connect to STP at " + webSocketUrl + ". \nSymbols will not be recognized. Please reload to try again";
                log(msg, sketchThruPlanSdk.StpMessageLevel.Error, true);
                return;
            }
            map = new GoogleMap(googleMapsKey, 'map', mapCenter, zoomLevel);
            map.onStrokeStart = (location, timestamp) => {
                stpsdk.sendPenDown(location, timestamp);
                recognizeSpeech();
            };
            map.onStrokeCompleted = (pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids) => {
                stpsdk.sendInk(pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids);
            };
            map.onSelection = (symbol) => {
                let contentString = buildInfo(symbol);
                if (contentString && symbol && symbol.poid && symbol.location && symbol.location.centroid) {
                    map.displayInfo(contentString, symbol.location.centroid, [
                        { selector: '#delButton', handler: (event) => {
                                stpsdk.deleteSymbol(symbol.poid);
                            }, closeInfo: true }
                    ]);
                }
            };
            map.load();
        });
    }
    function recognizeSpeech() {
        return __awaiter$1(this, void 0, void 0, function* () {
            try {
                const speechreco = new sketchThruPlanSdk.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint);
                let recoResult = yield speechreco.recognize();
                if (recoResult) {
                    stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
                    if (recoResult.results && recoResult.results.length > 0) {
                        log(recoResult.results[0].text);
                    }
                }
            }
            catch (e) {
                let msg = "Failed to process speech: " + e.message;
                log(msg), true;
            }
        });
    }
    function buildInfo(symbol) {
        var _a, _b, _c, _d;
        if (!symbol || !symbol.location || !symbol.location.centroid) {
            return null;
        }
        let contentString = '<h3 id="firstHeading" class="firstHeading">' + symbol.fullDescription + '</h3>' +
            '<table>' +
            '<tr>' +
            '<td>2525D PartA</td><td>' + ((_a = symbol.sidc) === null || _a === void 0 ? void 0 : _a.partA) + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>2525D PartB</td><td>' + ((_b = symbol.sidc) === null || _b === void 0 ? void 0 : _b.partB) + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>Symbol Set</td><td>' + ((_c = symbol.sidc) === null || _c === void 0 ? void 0 : _c.symbolSet) + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>2525C SIDC</td><td>' + ((_d = symbol.sidc) === null || _d === void 0 ? void 0 : _d.legacy) + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>Affiliation</td><td>' + symbol.affiliation + '</td>' +
            '</tr>';
        if (symbol.fsTYPE == "unit") {
            contentString +=
                '<tr>' +
                    '<td>Echelon</td><td>' + symbol.echelon + '</td>' +
                    '</tr>';
        }
        contentString +=
            '<tr>' +
                '<td>Parent Unit</td><td>' + symbol.parent + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td>Designator 1</td><td>' + symbol.designator1 + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td>Designator 2</td><td>' + symbol.designator2 + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td>Status</td><td>' + symbol.status + '</td>' +
                '</tr>';
        if (symbol.fsTYPE == "unit") {
            contentString +=
                '<tr>' +
                    '<td>Modifier</td><td>' + symbol.modifier + '</td>' +
                    '</tr>' +
                    '<tr>' +
                    '<td>Strength</td><td>' + symbol.strength + '</td>' +
                    '</tr>';
        }
        contentString +=
            '<tr>' +
                '<td>Time From</td><td>' + symbol.timeFrom + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td>Time To</td><td>' + symbol.timeTo + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td>Altitude</td><td>' + symbol.altitude + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td>Min Altitude</td><td>' + symbol.minAltitude + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td>Max Altitude</td><td>' + symbol.maxAltitude + '</td>' +
                '</tr>' +
                '<tr>' +
                '<td><button id="delButton">Delete</button></td>' +
                '</tr>' +
                '</table>';
        return contentString;
    }
    function log(msg, level, showAlert) {
        if (showAlert) {
            alert(msg);
        }
        let control = document.getElementById("messages");
        if (!control) {
            throw new Error("Html page must contain a 'messages' div");
        }
        control.innerHTML = msg;
        control.style.color = level === "Error" ? "red" : "black";
    }

}(StpSDK));
