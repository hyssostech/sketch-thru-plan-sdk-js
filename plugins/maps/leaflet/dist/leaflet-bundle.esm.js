class LeafletMap {
    constructor(apiKey, mapDivId, mapCenter, zoomLevel) {
        this.strokeStart = '';
        this.strokeEnd = '';
        this.assets = new Map();
        this.load = async () => {
            const mapDiv = document.getElementById(this.mapDivId);
            if (!mapDiv)
                throw new Error("Html page must contain a '#map' div");
            this.mapRef = L.map(mapDiv, {
                center: [this.mapCenter.lat, this.mapCenter.lon],
                zoom: this.zoomLevel,
                zoomControl: true
            });
            // Force crosshair cursor to indicate sketch readiness
            this.mapRef.getContainer().style.cursor = 'crosshair';
            // Override Leaflet's default pointer on interactive layers
            const style = document.createElement('style');
            style.textContent = '.leaflet-container, .leaflet-interactive { cursor: crosshair !important; }';
            document.head.appendChild(style);
            // OpenTopoMap for elevation context
            L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap'
            }).addTo(this.mapRef);
            // Left-click to start drawing anywhere
            this.mapRef.on('mousedown', (e) => {
                var _a;
                if (e.originalEvent && e.originalEvent.button !== 0)
                    return;
                if (e.originalEvent && e.originalEvent.ctrlKey)
                    return; // allow pan with Ctrl
                e.originalEvent && e.originalEvent.preventDefault();
                this.enableDrawing();
                const latlng = e.latlng;
                (_a = this.onStrokeStart) === null || _a === void 0 ? void 0 : _a.call(this, { lat: latlng.lat, lon: latlng.lng }, this.getIsoTimestamp());
                this.drawFreeHand(latlng);
            });
        };
        this.drawFreeHand = (latLng) => {
            this.strokeStart = this.getIsoTimestamp();
            this.clearInk();
            this.strokePoly = L.polyline([], { color: '#8B0000', weight: 2, interactive: false }).addTo(this.mapRef);
            this.strokePoly.addLatLng(latLng);
            const onMove = (e) => {
                this.strokePoly.addLatLng(e.latlng);
            };
            this.moveListener = onMove;
            this.mapRef.on('mousemove', onMove);
            let finished = false;
            const finishStroke = () => {
                var _a;
                if (finished)
                    return;
                finished = true;
                this.strokeEnd = this.getIsoTimestamp();
                if (this.moveListener) {
                    this.mapRef.off('mousemove', this.moveListener);
                    this.moveListener = undefined;
                }
                this.enableDragZoom();
                const latlngs = this.strokePoly.getLatLngs();
                if (latlngs.length === 1)
                    latlngs.push(latlngs[0]);
                const strokeLatLng = latlngs.map((item) => ({ lat: item.lat, lon: item.lng }));
                const mapDiv = document.getElementById(this.mapDivId);
                const sizePixels = { width: mapDiv.clientWidth, height: mapDiv.clientHeight };
                const mapBounds = this.mapRef.getBounds();
                const ne = mapBounds.getNorthEast();
                const sw = mapBounds.getSouthWest();
                (_a = this.onStrokeCompleted) === null || _a === void 0 ? void 0 : _a.call(this, { width: sizePixels.width, height: sizePixels.height }, { lat: ne.lat, lon: sw.lng }, { lat: sw.lat, lon: ne.lng }, strokeLatLng, this.strokeStart, this.strokeEnd, []);
            };
            this.mapRef.once('mouseup', finishStroke);
            document.addEventListener('mouseup', finishStroke, { once: true });
        };
        this.enableDrawing = () => {
            this.mapRef.dragging.disable();
            this.mapRef.scrollWheelZoom.disable();
            this.mapRef.doubleClickZoom.disable();
            // Keep crosshair during drawing
            this.mapRef.getContainer().style.cursor = 'crosshair';
        };
        this.enableDragZoom = () => {
            this.mapRef.dragging.enable();
            this.mapRef.scrollWheelZoom.enable();
            this.mapRef.doubleClickZoom.enable();
            // Restore crosshair after drawing as default interaction hint
            this.mapRef.getContainer().style.cursor = 'crosshair';
        };
        this.addFeature = (symbolGeoJSON) => {
            var _a, _b;
            if (!symbolGeoJSON)
                return;
            const poid = ((_b = (_a = symbolGeoJSON === null || symbolGeoJSON === void 0 ? void 0 : symbolGeoJSON.properties) === null || _a === void 0 ? void 0 : _a.symbol) === null || _b === void 0 ? void 0 : _b.poid) || (symbolGeoJSON === null || symbolGeoJSON === void 0 ? void 0 : symbolGeoJSON.poid);
            const layer = L.geoJSON(symbolGeoJSON, {
                style: () => ({ color: '#000', weight: 2, interactive: true, pane: 'overlayPane' }),
                onEachFeature: (feature, lyr) => {
                    lyr.on('contextmenu', () => { var _a; return (_a = this.onSelection) === null || _a === void 0 ? void 0 : _a.call(this, feature.properties.symbol); });
                },
                pointToLayer: (feature, latlng) => {
                    const rend = feature.properties && feature.properties.rendering;
                    if (rend && rend.length) {
                        // Use the first rendering entry to create an icon
                        const entry = rend[0];
                        const icon = L.icon({
                            iconUrl: 'data:image/svg+xml;charset=UTF-8;base64,' + entry.svg,
                            iconAnchor: [entry.anchor.x, entry.anchor.y]
                        });
                        const marker = L.marker([entry.position.lat, entry.position.lon], { icon, interactive: true });
                        if (entry.title)
                            marker.bindTooltip(entry.title, { permanent: false });
                        marker.on('contextmenu', () => { var _a; return (_a = this.onSelection) === null || _a === void 0 ? void 0 : _a.call(this, feature.properties.symbol); });
                        return marker;
                    }
                    return L.circleMarker(latlng, { radius: 6, color: '#000' });
                }
            }).addTo(this.mapRef);
            if (poid) {
                const arr = this.assets.get(poid) || [];
                arr.push(layer);
                this.assets.set(poid, arr);
            }
        };
        this.removeFeature = (poid) => {
            if (!poid)
                return;
            const layers = this.assets.get(poid);
            if (!layers)
                return;
            layers.forEach(l => this.mapRef.removeLayer(l));
            this.assets.delete(poid);
        };
        this.addPoly = (coords, color = '#66cc00', weight = 2) => {
            if (!coords || coords.length === 0)
                return;
            const latlngs = coords.map(c => [c.lat, c.lon]);
            L.polyline(latlngs, { color, weight, interactive: false }).addTo(this.mapRef);
        };
        this.getBounds = () => this.mapRef.getBounds();
        this.displayInfo = (content, location, handlers) => {
            const node = document.createElement('div');
            node.innerHTML = content;
            const popup = L.popup({ closeOnClick: true })
                .setLatLng([location.lat, location.lon])
                .setContent(node)
                .openOn(this.mapRef);
            if (popup && handlers && handlers.length) {
                for (let i = 0; i < handlers.length; i++) {
                    const instance = node.querySelector(handlers[i].selector);
                    if (instance && handlers[i].handler) {
                        instance.addEventListener('click', (event) => {
                            if (handlers[i].closeInfo)
                                this.mapRef.closePopup(popup);
                            handlers[i].handler(event);
                        });
                    }
                }
            }
        };
        this.clearInk = () => {
            if (this.strokePoly) {
                this.mapRef.removeLayer(this.strokePoly);
                this.strokePoly = undefined;
            }
        };
        this.getIsoTimestamp = () => new Date().toISOString();
        this.apiKey = apiKey;
        this.mapDivId = mapDivId;
        this.mapCenter = mapCenter;
        this.zoomLevel = zoomLevel;
    }
}
window.LeafletMap = LeafletMap;

export { LeafletMap };
