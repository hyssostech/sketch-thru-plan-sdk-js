export class GoogleMap {
    constructor(apiKey, mapDivId, mapCenter, zoomLevel) {
        this.strokeStart = '';
        this.strokeEnd = '';
        this.assets = new Map();
        this.load = async () => {
            const loader = new google.maps.plugins.loader.Loader({ apiKey: this.apiKey, version: 'weekly' });
            loader.loadCallback(async (e) => {
                if (e) {
                    console.log(e);
                    throw new Error(e);
                }
                else {
                    await this.initMap();
                }
            });
        };
        this.initMap = async () => {
            const mapDiv = document.getElementById(this.mapDivId);
            if (!mapDiv)
                throw new Error("Html page must contain a '#map' div");
            this.mapRef = new google.maps.Map(mapDiv, {
                mapTypeId: google.maps.MapTypeId.TERRAIN,
                zoom: this.zoomLevel,
                center: { lat: this.mapCenter.lat, lng: this.mapCenter.lon },
                gestureHandling: 'cooperative',
                draggable: true,
                draggableCursor: 'crosshair'
            });
            const mapStyles = [
                { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] }
            ];
            this.mapRef.setOptions({ styles: mapStyles });
            this.mapRef.data.setStyle((feature) => {
                const rend = feature.getProperty('rendering');
                if (rend) {
                    for (let i = 0; i < rend.length; i++) {
                        const shape = rend[i].shape.map((item) => [item.x, item.y]).flat();
                        const marker = new google.maps.Marker({
                            map: this.mapRef,
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8;base64,' + rend[i].svg,
                                anchor: new google.maps.Point(rend[i].anchor.x, rend[i].anchor.y)
                            },
                            shape: { type: 'poly', coords: shape },
                            cursor: 'crosshair',
                            position: { lat: rend[i].position.lat, lng: rend[i].position.lon }
                        });
                        if (rend[i].title)
                            marker.setTitle(rend[i].title);
                        marker.addListener('rightclick', () => {
                            var _a;
                            (_a = this.onSelection) === null || _a === void 0 ? void 0 : _a.call(this, feature.getProperty('symbol'));
                        });
                        marker.addListener('mousedown', (e) => {
                            var _a;
                            if (e && e.domEvent && e.domEvent.button === 0) {
                                e.domEvent.preventDefault();
                                this.enableDrawing();
                                (_a = this.onStrokeStart) === null || _a === void 0 ? void 0 : _a.call(this, { lat: e.latLng.lat(), lon: e.latLng.lng() }, this.getIsoTimestamp());
                                this.drawFreeHand(e.latLng);
                            }
                        });
                        const poid = feature.getProperty('symbol').poid;
                        if (!this.assets.has(poid))
                            this.assets.set(poid, [marker]);
                        else
                            this.assets.get(poid).push(marker);
                    }
                    return { visible: feature.getGeometry().getType() != 'Point', cursor: 'crosshair' };
                }
                return { visible: true, cursor: 'crosshair' };
            });
            this.mapRef.data.addListener('mousedown', (event) => {
                var _a, _b;
                if (event && event.domEvent) {
                    const btn = event.domEvent.button;
                    if (btn === 2) {
                        (_a = this.onSelection) === null || _a === void 0 ? void 0 : _a.call(this, event.feature.getProperty('symbol'));
                    }
                    else if (btn === 0) {
                        event.domEvent.preventDefault();
                        this.enableDrawing();
                        (_b = this.onStrokeStart) === null || _b === void 0 ? void 0 : _b.call(this, { lat: event.latLng.lat(), lon: event.latLng.lng() }, this.getIsoTimestamp());
                        this.drawFreeHand(event.latLng);
                    }
                }
            });
            this.mapRef.addListener('mousedown', (e) => {
                var _a;
                if (e && e.domEvent && e.domEvent.button !== 0)
                    return;
                if (e.domEvent && e.domEvent.ctrlKey)
                    return false;
                e.domEvent && e.domEvent.preventDefault();
                this.enableDrawing();
                (_a = this.onStrokeStart) === null || _a === void 0 ? void 0 : _a.call(this, { lat: e.latLng.lat(), lon: e.latLng.lng() }, this.getIsoTimestamp());
                this.drawFreeHand(e.latLng);
            });
        };
        this.drawFreeHand = (latLng) => {
            this.strokeStart = this.getIsoTimestamp();
            this.clearInk();
            this.strokePoly = new google.maps.Polyline({
                map: this.mapRef,
                clickable: false,
                strokeColor: '#8B0000',
                strokeWeight: 2
            });
            this.strokePoly.getPath().push(latLng);
            this.moveListener = google.maps.event.addListener(this.mapRef, 'mousemove', (e) => {
                this.strokePoly.getPath().push(e.latLng);
            });
            let finished = false;
            const finishStroke = () => {
                var _a;
                if (finished)
                    return;
                finished = true;
                this.strokeEnd = this.getIsoTimestamp();
                if (this.moveListener) {
                    google.maps.event.removeListener(this.moveListener);
                    this.moveListener = undefined;
                }
                this.enableDragZoom();
                const path = this.strokePoly.getPath();
                if (path.getLength() == 1)
                    path.push(path.getAt(0));
                const strokeLatLng = path.getArray().map((item) => ({ lat: item.lat(), lon: item.lng() }));
                const sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
                const mapBounds = this.mapRef.getBounds();
                if (!mapBounds)
                    throw new Error('Failed to retrieve the map bounds - unable to send ink to STP');
                (_a = this.onStrokeCompleted) === null || _a === void 0 ? void 0 : _a.call(this, { width: sizePixels.width, height: sizePixels.height }, { lat: mapBounds.getNorthEast().lat(), lon: mapBounds.getSouthWest().lng() }, { lat: mapBounds.getSouthWest().lat(), lon: mapBounds.getNorthEast().lng() }, strokeLatLng, this.strokeStart, this.strokeEnd, []);
            };
            google.maps.event.addListenerOnce(this.mapRef, 'mouseup', finishStroke);
            document.addEventListener('mouseup', finishStroke, { once: true });
        };
        this.enableDrawing = () => {
            this.mapRef.setOptions({ draggable: false, zoomControl: false, scrollwheel: false, disableDoubleClickZoom: false });
        };
        this.enableDragZoom = () => {
            this.mapRef.setOptions({ draggable: true, zoomControl: true, scrollwheel: true, disableDoubleClickZoom: true });
        };
        this.addFeature = (symbolGeoJSON) => {
            if (symbolGeoJSON)
                this.mapRef.data.addGeoJson(symbolGeoJSON);
        };
        this.removeFeature = (poid) => {
            var _a;
            const feature = (_a = this.mapRef) === null || _a === void 0 ? void 0 : _a.data.getFeatureById(poid);
            if (feature) {
                if (this.assets.has(poid)) {
                    const markers = this.assets.get(poid);
                    for (let i = 0; i < markers.length; i++)
                        markers[i].setMap(null);
                }
                this.mapRef.data.remove(feature);
            }
        };
        this.addPoly = (coords, color = '#66cc00', weight = 2) => {
            if (!coords || coords.length === 0)
                return;
            if (coords.length === 1) {
                coords.push(coords[0]);
                weight *= 2;
            }
            new google.maps.Polyline({
                map: this.mapRef,
                path: coords.map(c => ({ lat: c.lat, lng: c.lon })),
                clickable: false,
                strokeColor: color,
                strokeWeight: weight
            });
        };
        this.getBounds = () => this.mapRef.getBounds();
        this.displayInfo = (content, location, handlers) => {
            const node = document.createElement('div');
            node.innerHTML = content;
            const centroid = { lat: location.lat, lng: location.lon };
            const infoWindow = new google.maps.InfoWindow({ content: node, position: centroid });
            if (infoWindow && handlers && handlers.length) {
                for (let i = 0; i < handlers.length; i++) {
                    const instance = node.querySelector(handlers[i].selector);
                    if (instance && handlers[i].handler) {
                        google.maps.event.addDomListener(instance, 'click', (event) => {
                            if (handlers[i].closeInfo)
                                infoWindow.close();
                            handlers[i].handler(event);
                        });
                    }
                }
            }
            infoWindow.open(this.mapRef);
        };
        this.clearInk = () => {
            var _a;
            (_a = this.strokePoly) === null || _a === void 0 ? void 0 : _a.setMap(null);
        };
        this.getIsoTimestamp = () => new Date().toISOString();
        this.apiKey = apiKey;
        this.mapDivId = mapDivId;
        this.mapCenter = mapCenter;
        this.zoomLevel = zoomLevel;
    }
}
window.GoogleMap = GoogleMap;
