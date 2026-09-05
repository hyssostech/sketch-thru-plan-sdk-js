import { LatLon, Size, StpSymbol } from "sketch-thru-plan-sdk";

declare const L: any;

type InfoHandlers = { selector: string, handler: (event: Event) => void, closeInfo: boolean };

export class LeafletMap {
  onStrokeStart: ((location: LatLon, timestamp: string) => void) | undefined;
  onStrokeCompleted: ((
    pixelBoundsWindow: Size,
    topLeftGeoMap: LatLon,
    bottomRightGeoMap: LatLon,
    strokePoints: LatLon[],
    timeStrokeStart: string,
    timeStrokeEnd: string,
    intersectedPoids: string[]
  ) => void) | undefined;
  onSelection: ((symbol: StpSymbol) => void) | undefined;

  apiKey: string | null;
  mapDivId: string;
  map: any;
  mapCenter: LatLon;
  zoomLevel: number;

  strokeStart: string = '';
  strokeEnd: string = '';
  strokePoly: any | null = null;

  geoJsonLayer: any;
  featureLayers: Map<string, any> = new Map();

  constructor(apiKey: string | null, mapDivId: string, mapCenter: LatLon, zoomLevel: number) {
    this.apiKey = apiKey;
    this.mapDivId = mapDivId;
    this.mapCenter = mapCenter;
    this.zoomLevel = zoomLevel;
  }

  load = async () => { await this.initMap(); }

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

    this.geoJsonLayer = L.geoJSON(null, {
      onEachFeature: (feature: any, layer: any) => {
        const poid = feature.id || (feature.properties && feature.properties.poid);
        if (poid) this.featureLayers.set(poid, layer);
        layer.on('click', () => {
          const symbol: StpSymbol | undefined = (feature.properties && feature.properties.symbol) || feature.symbol;
          if (symbol) this.onSelection?.call(this, symbol);
        });
      }
    }).addTo(this.map);

    this.map.on('mousedown', (e: any) => {
      const domEvt: MouseEvent = e.originalEvent;
      if (domEvt && (domEvt as any).ctrlKey) return false;
      domEvt && domEvt.preventDefault();
      this.enableDrawing();
      const latlng = e.latlng;
      this.onStrokeStart?.call(this, new LatLon(latlng.lat, latlng.lng), this.getIsoTimestamp());
      this.drawFreeHand(latlng);
    });
  }

  private drawFreeHand(latlng: any) {
    this.strokeStart = this.getIsoTimestamp();
    this.clearInk();
    this.strokePoly = L.polyline([], { color: '#8B0000', weight: 2 }).addTo(this.map);
    this.strokePoly.addLatLng(latlng);

    const moveHandler = (e: any) => { this.strokePoly!.addLatLng(e.latlng); };
    const upHandler = () => {
      this.strokeEnd = this.getIsoTimestamp();
      this.disableDrawing();
      this.map.off('mousemove', moveHandler);
      this.map.off('mouseup', upHandler);

      const pts = this.strokePoly!.getLatLngs();
      if (pts.length === 1) pts.push(pts[0]);
      const strokeLatLng: LatLon[] = pts.map((p: any) => new LatLon(p.lat, p.lng));

      const sizePixels = { width: document.getElementById('map')!.clientWidth, height: document.getElementById('map')!.clientHeight };
      const b = this.map.getBounds();
      this.onStrokeCompleted?.call(this,
        new Size(sizePixels.width, sizePixels.height),
        new LatLon(b.getNorthEast().lat, b.getSouthWest().lng),
        new LatLon(b.getSouthWest().lat, b.getNorthEast().lng),
        strokeLatLng,
        this.strokeStart,
        this.strokeEnd,
        []
      );
    };
    this.map.on('mousemove', moveHandler);
    this.map.on('mouseup', upHandler);
  }

  private enableDrawing() {
    this.map.dragging.disable();
    this.map.scrollWheelZoom.disable();
    this.map.doubleClickZoom.disable();
    // Keep crosshair during drawing
    this.map.getContainer().style.cursor = 'crosshair';
  }

  private disableDrawing() {
    this.map.dragging.enable();
    this.map.scrollWheelZoom.enable();
    this.map.doubleClickZoom.enable();
    // Restore crosshair after drawing as default interaction hint
    this.map.getContainer().style.cursor = 'crosshair';
  }

  addFeature(symbolGeoJSON: GeoJSON.Feature) { if (symbolGeoJSON) this.geoJsonLayer.addData(symbolGeoJSON); }

  removeFeature(poid: string) {
    const layer = this.featureLayers.get(poid);
    if (layer) {
      this.geoJsonLayer.removeLayer(layer);
      this.featureLayers.delete(poid);
    }
  }

  displayInfo(content: string, location: LatLon, handlers: InfoHandlers[]) {
    const node = document.createElement('div');
    node.innerHTML = content;
    const popup = L.popup({ closeButton: true })
      .setLatLng([location.lat, location.lon])
      .setContent(node)
      .openOn(this.map);

    if (popup && handlers && handlers.length) {
      for (let i = 0; i < handlers.length; i++) {
        const instance = node.querySelector(handlers[i].selector)!;
        if (instance && handlers[i].handler) {
          instance.addEventListener('click', (event) => {
            if (handlers[i].closeInfo) popup.remove();
            handlers[i].handler(event);
          });
        }
      }
    }
  }

  clearInk() { if (this.strokePoly) { this.map.removeLayer(this.strokePoly); this.strokePoly = null; } }
  getBounds() { return this.map.getBounds(); }
  private getIsoTimestamp() { return new Date().toISOString(); }
}
