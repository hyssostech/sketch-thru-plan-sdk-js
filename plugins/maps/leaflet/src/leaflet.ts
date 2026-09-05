declare const L: any;
import { IMapAdapter } from '../../interfaces/IMapAdapter';

export class LeafletMap implements IMapAdapter {
  // Events
  onStrokeStart?: (location: { lat: number; lon: number }, timestamp: string) => void;
  onStrokeCompleted?: (
    pixelBoundsWindow: { width: number; height: number },
    topLeftGeoMap: { lat: number; lon: number },
    bottomRightGeoMap: { lat: number; lon: number },
    strokePoints: Array<{ lat: number; lon: number }>,
    timeStrokeStart: string,
    timeStrokeEnd: string,
    intersectedPoids: string[]
  ) => void;
  onSelection?: (symbol: any) => void;

  // Properties
  apiKey: string; // unused for Leaflet, kept for parity
  mapCenter: { lat: number; lon: number };
  zoomLevel: number;
  mapDivId: string;

  private mapRef: any;
  private strokeStart: string = '';
  private strokeEnd: string = '';
  private strokePoly: any;
  private moveListener: any;
  private assets: Map<string, Array<any>> = new Map();

  constructor(apiKey: string, mapDivId: string, mapCenter: { lat: number; lon: number }, zoomLevel: number) {
    this.apiKey = apiKey;
    this.mapDivId = mapDivId;
    this.mapCenter = mapCenter;
    this.zoomLevel = zoomLevel;
  }

  load = async () => {
    const mapDiv = document.getElementById(this.mapDivId);
    if (!mapDiv) throw new Error("Html page must contain a '#map' div");

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
    this.mapRef.on('mousedown', (e: any) => {
      if (e.originalEvent && e.originalEvent.button !== 0) return;
      if (e.originalEvent && e.originalEvent.ctrlKey) return; // allow pan with Ctrl
      e.originalEvent && e.originalEvent.preventDefault();
      this.enableDrawing();
      const latlng = e.latlng;
      this.onStrokeStart?.call(this, { lat: latlng.lat, lon: latlng.lng }, this.getIsoTimestamp());
      this.drawFreeHand(latlng);
    });
  };

  drawFreeHand = (latLng: any) => {
    this.strokeStart = this.getIsoTimestamp();
    this.clearInk();

    this.strokePoly = L.polyline([], { color: '#8B0000', weight: 2, interactive: false }).addTo(this.mapRef);
    this.strokePoly.addLatLng(latLng);

    const onMove = (e: any) => {
      this.strokePoly.addLatLng(e.latlng);
    };
    this.moveListener = onMove;
    this.mapRef.on('mousemove', onMove);

    let finished = false;
    const finishStroke = () => {
      if (finished) return;
      finished = true;
      this.strokeEnd = this.getIsoTimestamp();
      if (this.moveListener) {
        this.mapRef.off('mousemove', this.moveListener);
        this.moveListener = undefined;
      }
      this.enableDragZoom();

      const latlngs = this.strokePoly.getLatLngs();
      if (latlngs.length === 1) latlngs.push(latlngs[0]);
      const strokeLatLng = latlngs.map((item: any) => ({ lat: item.lat, lon: item.lng }));

      const mapDiv = document.getElementById(this.mapDivId) as HTMLElement;
      const sizePixels = { width: mapDiv.clientWidth, height: mapDiv.clientHeight };
      const mapBounds = this.mapRef.getBounds();
      const ne = mapBounds.getNorthEast();
      const sw = mapBounds.getSouthWest();

      this.onStrokeCompleted?.call(
        this,
        { width: sizePixels.width, height: sizePixels.height },
        { lat: ne.lat, lon: sw.lng },
        { lat: sw.lat, lon: ne.lng },
        strokeLatLng,
        this.strokeStart,
        this.strokeEnd,
        []
      );
    };
    this.mapRef.once('mouseup', finishStroke);
    document.addEventListener('mouseup', finishStroke, { once: true });
  };

  enableDrawing = () => {
    this.mapRef.dragging.disable();
    this.mapRef.scrollWheelZoom.disable();
    this.mapRef.doubleClickZoom.disable();
    // Keep crosshair during drawing
    this.mapRef.getContainer().style.cursor = 'crosshair';
  };
  enableDragZoom = () => {
    this.mapRef.dragging.enable();
    this.mapRef.scrollWheelZoom.enable();
    this.mapRef.doubleClickZoom.enable();
    // Restore crosshair after drawing as default interaction hint
    this.mapRef.getContainer().style.cursor = 'crosshair';
  };

  addFeature = (symbolGeoJSON: any) => {
    if (!symbolGeoJSON) return;
    const poid = symbolGeoJSON?.properties?.symbol?.poid || symbolGeoJSON?.poid;
    const layer = L.geoJSON(symbolGeoJSON, {
      style: () => ({ color: '#000', weight: 2, interactive: true, pane: 'overlayPane' }),
      onEachFeature: (feature: any, lyr: any) => {
        lyr.on('contextmenu', () => this.onSelection?.call(this, feature.properties.symbol));
      },
      pointToLayer: (feature: any, latlng: any) => {
        const rend = feature.properties && feature.properties.rendering;
        if (rend && rend.length) {
          // Use the first rendering entry to create an icon
          const entry = rend[0];
          const icon = L.icon({
            iconUrl: 'data:image/svg+xml;charset=UTF-8;base64,' + entry.svg,
            iconAnchor: [entry.anchor.x, entry.anchor.y]
          });
          const marker = L.marker([entry.position.lat, entry.position.lon], { icon, interactive: true });
          if (entry.title) marker.bindTooltip(entry.title, { permanent: false });
          marker.on('contextmenu', () => this.onSelection?.call(this, feature.properties.symbol));
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

  removeFeature = (poid: string) => {
    if (!poid) return;
    const layers = this.assets.get(poid);
    if (!layers) return;
    layers.forEach(l => this.mapRef.removeLayer(l));
    this.assets.delete(poid);
  };

  addPoly = (coords: Array<{ lat: number; lon: number }>, color = '#66cc00', weight = 2) => {
    if (!coords || coords.length === 0) return;
    const latlngs = coords.map(c => [c.lat, c.lon]);
    L.polyline(latlngs, { color, weight, interactive: false }).addTo(this.mapRef);
  };

  getBounds = () => this.mapRef.getBounds();

  displayInfo = (content: string, location: { lat: number; lon: number }, handlers?: Array<{ selector: string; handler: (e: Event) => void; closeInfo?: boolean }>) => {
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
          instance.addEventListener('click', (event: any) => {
            if (handlers[i].closeInfo) this.mapRef.closePopup(popup);
            handlers[i].handler(event);
          });
        }
      }
    }
  };

  clearInk = () => {
    if (this.strokePoly) {
      this.mapRef.removeLayer(this.strokePoly);
      this.strokePoly = undefined;
    }
  };

  getIsoTimestamp = () => new Date().toISOString();
}

(window as any).LeafletMap = LeafletMap;
