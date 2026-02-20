declare const google: any;
import { IMapAdapter } from '../../interfaces/IMapAdapter';

export class GoogleMap implements IMapAdapter {
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
  apiKey: string;
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
    const loader = new google.maps.plugins.loader.Loader({ apiKey: this.apiKey, version: 'weekly' });
    loader.loadCallback(async (e: any) => {
      if (e) {
        console.log(e);
        throw new Error(e);
      } else {
        await this.initMap();
      }
    });
  };

  initMap = async () => {
    const mapDiv = document.getElementById(this.mapDivId);
    if (!mapDiv) throw new Error("Html page must contain a '#map' div");

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

    this.mapRef.data.setStyle((feature: any) => {
      const rend = feature.getProperty('rendering');
      if (rend) {
        for (let i = 0; i < rend.length; i++) {
          const shape = rend[i].shape.map((item: any) => [item.x, item.y]).flat();
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
          if (rend[i].title) marker.setTitle(rend[i].title);

          marker.addListener('rightclick', () => {
            this.onSelection?.call(this, feature.getProperty('symbol'));
          });
          marker.addListener('mousedown', (e: any) => {
            if (e && e.domEvent && e.domEvent.button === 0) {
              e.domEvent.preventDefault();
              this.enableDrawing();
              this.onStrokeStart?.call(this, { lat: e.latLng.lat(), lon: e.latLng.lng() }, this.getIsoTimestamp());
              this.drawFreeHand(e.latLng);
            }
          });

          const poid = feature.getProperty('symbol').poid;
          if (!this.assets.has(poid)) this.assets.set(poid, [marker]);
          else this.assets.get(poid)!.push(marker);
        }
        return { visible: feature.getGeometry().getType() != 'Point', cursor: 'crosshair' };
      }
      return { visible: true, cursor: 'crosshair' };
    });

    this.mapRef.data.addListener('mousedown', (event: any) => {
      if (event && event.domEvent) {
        const btn = event.domEvent.button;
        if (btn === 2) {
          this.onSelection?.call(this, event.feature.getProperty('symbol'));
        } else if (btn === 0) {
          event.domEvent.preventDefault();
          this.enableDrawing();
          this.onStrokeStart?.call(this, { lat: event.latLng.lat(), lon: event.latLng.lng() }, this.getIsoTimestamp());
          this.drawFreeHand(event.latLng);
        }
      }
    });

    this.mapRef.addListener('mousedown', (e: any) => {
      if (e && e.domEvent && e.domEvent.button !== 0) return;
      if (e.domEvent && e.domEvent.ctrlKey) return false;
      e.domEvent && e.domEvent.preventDefault();
      this.enableDrawing();
      this.onStrokeStart?.call(this, { lat: e.latLng.lat(), lon: e.latLng.lng() }, this.getIsoTimestamp());
      this.drawFreeHand(e.latLng);
    });
  };

  drawFreeHand = (latLng: any) => {
    this.strokeStart = this.getIsoTimestamp();
    this.clearInk();

    this.strokePoly = new google.maps.Polyline({
      map: this.mapRef,
      clickable: false,
      strokeColor: '#8B0000',
      strokeWeight: 2
    });
    this.strokePoly.getPath().push(latLng);

    this.moveListener = google.maps.event.addListener(this.mapRef, 'mousemove', (e: any) => {
      this.strokePoly.getPath().push(e.latLng);
    });

    let finished = false;
    const finishStroke = () => {
      if (finished) return;
      finished = true;
      this.strokeEnd = this.getIsoTimestamp();
      if (this.moveListener) {
        google.maps.event.removeListener(this.moveListener);
        this.moveListener = undefined;
      }
      this.enableDragZoom();

      const path = this.strokePoly.getPath();
      if (path.getLength() == 1) path.push(path.getAt(0));
      const strokeLatLng = path.getArray().map((item: any) => ({ lat: item.lat(), lon: item.lng() }));

      const sizePixels = { width: (document.getElementById('map') as HTMLElement).clientWidth, height: (document.getElementById('map') as HTMLElement).clientHeight };
      const mapBounds = this.mapRef.getBounds();
      if (!mapBounds) throw new Error('Failed to retrieve the map bounds - unable to send ink to STP');
      this.onStrokeCompleted?.call(
        this,
        { width: sizePixels.width, height: sizePixels.height },
        { lat: mapBounds.getNorthEast().lat(), lon: mapBounds.getSouthWest().lng() },
        { lat: mapBounds.getSouthWest().lat(), lon: mapBounds.getNorthEast().lng() },
        strokeLatLng,
        this.strokeStart,
        this.strokeEnd,
        []
      );
    };
    google.maps.event.addListenerOnce(this.mapRef, 'mouseup', finishStroke);
    document.addEventListener('mouseup', finishStroke, { once: true });
  };

  enableDrawing = () => {
    this.mapRef.setOptions({ draggable: false, zoomControl: false, scrollwheel: false, disableDoubleClickZoom: false });
  };
  enableDragZoom = () => {
    this.mapRef.setOptions({ draggable: true, zoomControl: true, scrollwheel: true, disableDoubleClickZoom: true });
  };

  addFeature = (symbolGeoJSON: any) => {
    if (symbolGeoJSON) this.mapRef.data.addGeoJson(symbolGeoJSON);
  };
  removeFeature = (poid: string) => {
    const feature = this.mapRef?.data.getFeatureById(poid);
    if (feature) {
      if (this.assets.has(poid)) {
        const markers = this.assets.get(poid)!;
        for (let i = 0; i < markers.length; i++) markers[i].setMap(null);
      }
      this.mapRef.data.remove(feature);
    }
  };

  addPoly = (coords: Array<{ lat: number; lon: number }>, color = '#66cc00', weight = 2) => {
    if (!coords || coords.length === 0) return;
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

  getBounds = () => this.mapRef.getBounds();

  displayInfo = (content: string, location: { lat: number; lon: number }, handlers?: Array<{ selector: string; handler: (e: Event) => void; closeInfo?: boolean }>) => {
    const node = document.createElement('div');
    node.innerHTML = content;
    const centroid = { lat: location.lat, lng: location.lon };
    const infoWindow = new google.maps.InfoWindow({ content: node, position: centroid });
    if (infoWindow && handlers && handlers.length) {
      for (let i = 0; i < handlers.length; i++) {
        const instance = node.querySelector(handlers[i].selector);
        if (instance && handlers[i].handler) {
          google.maps.event.addDomListener(instance, 'click', (event: any) => {
            if (handlers[i].closeInfo) infoWindow.close();
            handlers[i].handler(event);
          });
        }
      }
    }
    infoWindow.open(this.mapRef);
  };

  clearInk = () => {
    this.strokePoly?.setMap(null);
  };

  getIsoTimestamp = () => new Date().toISOString();
}

(window as any).GoogleMap = GoogleMap;
