/**
 * Minimal Leaflet map for quickstart: sketch capture and GeoJSON display
 */
class LeafletMap {
  // Events
  onStrokeStart;
  onStrokeCompleted;
  onSelection;

  // Properties
  apiKey;
  mapDivId;
  map;
  mapCenter;
  zoomLevel;

  strokeStart;
  strokeEnd;
  strokePoly;

  featureLayers;

  constructor(apiKey, mapDivId, mapCenter, zoomLevel) {
    this.apiKey = apiKey;
    this.mapDivId = mapDivId;
    this.mapCenter = mapCenter;
    this.zoomLevel = zoomLevel;
    this.strokeStart = this.strokeEnd = '';
    this.featureLayers = new Map();
  }

  load = async () => {
    await this.initMap();
  }

  async initMap() {
    const mapDiv = document.getElementById(this.mapDivId);
    if (!mapDiv) throw new Error("Html page must contain a 'map' div");

    this.map = L.map(mapDiv).setView([this.mapCenter.lat, this.mapCenter.lon], this.zoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Force crosshair cursor to indicate sketch readiness
    this.map.getContainer().style.cursor = 'crosshair';
    // Override Leaflet's default pointer on interactive layers
    const style = document.createElement('style');
    style.textContent = '.leaflet-container, .leaflet-interactive { cursor: crosshair !important; }';
    document.head.appendChild(style);

    // GeoJSON layer with selection handling
    this.geoJsonLayer = L.geoJSON(null, {
      onEachFeature: (feature, layer) => {
        // Track layers by feature id or poid
        const poid = feature.id || (feature.properties && feature.properties.poid);
        if (poid) this.featureLayers.set(poid, layer);
        layer.on('click', () => {
          const symbol = (feature.properties && feature.properties.symbol) || feature.symbol;
          this.onSelection?.call(this, symbol);
        });
      }
    }).addTo(this.map);

    // Mouse events for sketch capture
    this.map.on('mousedown', (e) => {
      const domEvt = e.originalEvent;
      if (domEvt && domEvt.ctrlKey) return false;
      domEvt && domEvt.preventDefault();
      this.enableDrawing();
      const latlng = e.latlng;
      this.onStrokeStart?.call(this, { lat: latlng.lat, lon: latlng.lng }, this.getIsoTimestamp());
      this.drawFreeHand(latlng);
    });
  }

  drawFreeHand(latlng) {
    this.strokeStart = this.getIsoTimestamp();
    this.clearInk();
    this.strokePoly = L.polyline([], { color: '#8B0000', weight: 2 }).addTo(this.map);
    this.strokePoly.addLatLng(latlng);

    const moveHandler = (e) => {
      this.strokePoly.addLatLng(e.latlng);
    };
    const upHandler = () => {
      this.strokeEnd = this.getIsoTimestamp();
      this.disableDrawing();
      this.map.off('mousemove', moveHandler);
      this.map.off('mouseup', upHandler);

      const pts = this.strokePoly.getLatLngs();
      if (pts.length === 1) pts.push(pts[0]);
      const strokeLatLng = pts.map(p => ({ lat: p.lat, lon: p.lng }));

      const sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
      const b = this.map.getBounds();
      if (this.onStrokeCompleted) {
        this.onStrokeCompleted(
          { width: sizePixels.width, height: sizePixels.height },
          { lat: b.getNorthEast().lat, lon: b.getSouthWest().lng },
          { lat: b.getSouthWest().lat, lon: b.getNorthEast().lng },
          strokeLatLng,
          this.strokeStart,
          this.strokeEnd,
          []
        );
      }
    };
    this.map.on('mousemove', moveHandler);
    this.map.on('mouseup', upHandler);
  }

  enableDrawing() {
    this.map.dragging.disable();
    this.map.scrollWheelZoom.disable();
    this.map.doubleClickZoom.disable();
    // Keep crosshair during drawing
    this.map.getContainer().style.cursor = 'crosshair';
  }

  disableDrawing() {
    this.map.dragging.enable();
    this.map.scrollWheelZoom.enable();
    this.map.doubleClickZoom.enable();
    // Restore crosshair after drawing as default interaction hint
    this.map.getContainer().style.cursor = 'crosshair';
  }

  addFeature(symbolGeoJSON) {
    if (symbolGeoJSON) this.geoJsonLayer.addData(symbolGeoJSON);
  }

  removeFeature(poid) {
    const layer = this.featureLayers.get(poid);
    if (layer) {
      this.geoJsonLayer.removeLayer(layer);
      this.featureLayers.delete(poid);
    }
  }

  displayInfo(content, location, handlers) {
    const node = document.createElement('div');
    node.innerHTML = content;
    const popup = L.popup({ closeButton: true })
      .setLatLng([location.lat, location.lon])
      .setContent(node)
      .openOn(this.map);

    if (handlers && handlers.length) {
      for (let i = 0; i < handlers.length; i++) {
        const instance = node.querySelector(handlers[i].selector);
        if (instance && handlers[i].handler) {
          instance.addEventListener('click', (event) => {
            if (handlers[i].closeInfo) popup.remove();
            handlers[i].handler(event);
          });
        }
      }
    }
  }

  clearInk() {
    if (this.strokePoly) {
      this.map.removeLayer(this.strokePoly);
      this.strokePoly = null;
    }
  }

  getBounds() {
    return this.map.getBounds();
  }

  getIsoTimestamp() {
    return new Date().toISOString();
  }
}
