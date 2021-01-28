var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { LatLon, Size } from "sketch-thru-plan-sdk";
export class GoogleMap {
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
                (_a = this.onStrokeStart) === null || _a === void 0 ? void 0 : _a.call(this, new LatLon(e.latLng.lat(), e.latLng.lng()), this.getIsoTimestamp());
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
            let strokeLatLng = path.getArray().map(item => { let o = new LatLon(item.lat(), item.lng()); return o; });
            let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
            let mapBounds = this.map.getBounds();
            if (!mapBounds) {
                throw new Error("Failed to retrieve the map bounds - unable to send ink to STP");
            }
            if (this.onStrokeCompleted) {
                this.onStrokeCompleted(new Size(sizePixels.width, sizePixels.height), new LatLon(mapBounds.getNorthEast().lat(), mapBounds.getSouthWest().lng()), new LatLon(mapBounds.getSouthWest().lat(), mapBounds.getNorthEast().lng()), strokeLatLng, this.strokeStart, this.strokeEnd, []);
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
    addFeature(symbolGeoJSON) {
        if (symbolGeoJSON) {
            this.map.data.addGeoJson(symbolGeoJSON);
        }
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
                        ;
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
    getBounds() {
        return this.map.getBounds();
    }
    getIsoTimestamp() {
        let timestamp = new Date();
        return timestamp.toISOString();
    }
}
//# sourceMappingURL=googlemap.js.map