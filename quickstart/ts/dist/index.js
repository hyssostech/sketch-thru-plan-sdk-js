(function (sketchThruPlanSdk) {
    'use strict';

    var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    const webSocketUrl = "ws://<STP server>:<STP port>";
    const googleMapsKey = "<Enter your Google Maps API key here>";
    const googleMapsUrl = "https://maps.googleapis.com/maps/api/js?key=" + googleMapsKey;
    const azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
    const azureServiceRegion = "<Enter Azure's subscription region>";
    let map;
    let strokeStart;
    let strokeEnd;
    let strokePoly;
    let stpsdk;
    (function addMapsScript() {
        if (!document.querySelectorAll('[src="' + googleMapsUrl + '"]').length) {
            document.body.appendChild(Object.assign(document.createElement('script'), {
                type: 'text/javascript',
                src: googleMapsUrl,
                onload: () => initMap()
            }));
        }
        else {
            initMap();
        }
    })();
    function initMap() {
        return __awaiter(this, void 0, void 0, function* () {
            let mapCenter = { lat: 58.967774948, lng: 11.196062412 };
            const stpconn = new sketchThruPlanSdk.StpWebSocketsConnector(webSocketUrl);
            stpsdk = new sketchThruPlanSdk.StpRecognizer(stpconn);
            stpsdk.onSymbolAdded = (symbol, isUndo) => {
                displaySymbol(symbol);
            };
            stpsdk.onInkProcessed = () => {
                if (strokePoly)
                    strokePoly.setMap(null);
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
                yield stpsdk.connect("GoogleMapsSample", 0);
            }
            catch (error) {
                let msg = "Failed to connect to STP at " + webSocketUrl + ". \nSymbols will not be recognized. Please reload to try again";
                log(msg, sketchThruPlanSdk.StpMessageLevel.Error, true);
            }
            const speechreco = new sketchThruPlanSdk.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion);
            const mapDiv = document.getElementById('map');
            if (!mapDiv) {
                throw new Error("Html page must contain a 'map' div");
            }
            map = new google.maps.Map(mapDiv, {
                zoom: 13,
                center: mapCenter,
                gestureHandling: 'cooperative',
                draggable: false,
                draggableCursor: 'crosshair'
            });
            map.addListener('mousedown', function (e) {
                let domEvent = e.vb;
                if (domEvent.ctrlKey) {
                    return false;
                }
                domEvent.preventDefault();
                enableDrawing();
                stpsdk.sendPenDown(new sketchThruPlanSdk.LatLon(e.latLng.lat(), e.latLng.lng()), getIsoTimestamp());
                recognizeSpeech(speechreco);
                drawFreeHand(e.latLng);
            });
        });
    }
    function drawFreeHand(latLng) {
        strokeStart = getIsoTimestamp();
        if (strokePoly)
            strokePoly.setMap(null);
        strokePoly = new google.maps.Polyline({
            map: map,
            clickable: false,
            strokeColor: '#8B0000',
            strokeWeight: 2,
        });
        strokePoly.getPath().push(latLng);
        var move = google.maps.event.addListener(map, 'mousemove', (e) => {
            strokePoly.getPath().push(e.latLng);
        });
        google.maps.event.addListenerOnce(map, 'mouseup', (e) => {
            strokeEnd = getIsoTimestamp();
            google.maps.event.removeListener(move);
            enableDragZoom();
            let path = strokePoly.getPath();
            if (path.getLength() == 1)
                path.push(path.getAt(0));
            let strokeLatLng = path.getArray().map(item => { let o = new sketchThruPlanSdk.LatLon(item.lat(), item.lng()); return o; });
            let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
            let mapBounds = map.getBounds();
            if (!mapBounds) {
                throw new Error("Failed to retrieve the map bounds - unable to send ink to STP");
            }
            stpsdk.sendInk(new sketchThruPlanSdk.Size(sizePixels.width, sizePixels.height), new sketchThruPlanSdk.LatLon(mapBounds.getNorthEast().lat(), mapBounds.getSouthWest().lng()), new sketchThruPlanSdk.LatLon(mapBounds.getSouthWest().lat(), mapBounds.getNorthEast().lng()), strokeLatLng, strokeStart, strokeEnd, []);
        });
    }
    function enableDrawing() {
        map.setOptions({
            draggable: false,
            zoomControl: false,
            scrollwheel: false,
            disableDoubleClickZoom: false
        });
    }
    function enableDragZoom() {
        map.setOptions({
            draggable: true,
            zoomControl: true,
            scrollwheel: true,
            disableDoubleClickZoom: true
        });
    }
    function recognizeSpeech(speechreco) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
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
    function displaySymbol(symbol) {
        const contentString = '<div id="content">' +
            '<div id="siteNotice">' +
            "</div>" +
            '<h3 id="firstHeading" class="firstHeading">' + symbol.fullDescription + '</h3>' +
            '<table>' +
            '<tr>' +
            '<td>2525D PartA</td><td>' + symbol.sidc.partA + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>2525D PartB</td><td>' + symbol.sidc.partB + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>Symbol Set</td><td>' + symbol.sidc.symbolSet + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>2525C SIDC</td><td>' + symbol.sidc.legacy + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>Affiliation</td><td>' + symbol.affiliation + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>Echelon</td><td>' + symbol.echelon + '</td>' +
            '</tr>' +
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
            '</tr>' +
            '<tr>' +
            '<td>Modifier</td><td>' + symbol.modifier + '</td>' +
            '</tr>' +
            '<tr>' +
            '<td>Strength</td><td>' + symbol.strength + '</td>' +
            '</tr>' +
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
            '</table>' +
            '<div id="bodyContent">' +
            "</div>" +
            "</div>";
        let centroid = { lat: symbol.location.centroid.lat, lng: symbol.location.centroid.lon };
        let infoWindow = new google.maps.InfoWindow({
            content: contentString,
            position: centroid,
        });
        if (symbol.fsTYPE === "tg") {
            let tgLatLng = symbol.location.coords.map(item => { let o = { lat: item.lat, lng: item.lon }; return o; });
            let options = {
                path: tgLatLng,
                geodesic: true,
                strokeColor: "black",
                strokeOpacity: 1.0,
                strokeWeight: 3,
            };
            if (symbol.location.fsTYPE === "area") {
                const tgPoly = new google.maps.Polygon(options);
                tgPoly.setMap(map);
                tgPoly.addListener("click", () => {
                    infoWindow.open(map);
                });
            }
            else {
                if (symbol.location.shape == "arrowfat")
                    tgLatLng.length--;
                const tgPoly = new google.maps.Polyline(options);
                tgPoly.setMap(map);
                tgPoly.addListener("click", () => {
                    infoWindow.open(map);
                });
            }
        }
        else {
            let iconPath;
            let iconFillColor;
            let iconStrokeColor;
            if (symbol.affiliation === "friend") {
                iconPath = "M -21,-15 -21,15 21,15 21,-15 z";
                iconFillColor = "#1077aa";
                iconStrokeColor = "#1077aa";
            }
            else if (symbol.affiliation === "hostile") {
                iconPath = "M -18,0 0,18 18,0 0,-18 z";
                iconFillColor = "red";
                iconStrokeColor = "red";
            }
            else {
                iconPath = "M 0, 0 m -18, 0 a 18,18 0 1,0 36,0 a 18,18 0 1,0 -36,0";
                iconFillColor = "yellow";
                iconStrokeColor = "yellow";
            }
            const icon = {
                fillOpacity: 0.5,
                scale: 1,
                strokeWeight: 1,
                path: iconPath,
                fillColor: iconFillColor,
                strokeColor: iconStrokeColor
            };
            const marker = new google.maps.Marker({
                position: centroid,
                map,
                title: symbol.description,
                icon: icon,
            });
            marker.addListener("click", () => {
                infoWindow.open(map, marker);
            });
        }
    }
    function getIsoTimestamp() {
        let timestamp = new Date();
        return timestamp.toISOString();
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
