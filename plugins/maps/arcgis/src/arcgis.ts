// ArcGIS JS API integration via AMD loader present on the page
// Assumes the application has loaded the ArcGIS JS API and its AMD `require` function globally.
// Example: <script src="https://js.arcgis.com/4.29/"></script>

import { IMapAdapter } from '../../interfaces/IMapAdapter';

declare const require: any;

export class ArcGISMap implements IMapAdapter {
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

  // Basic map properties
  apiKey: string | null; // not used by ArcGIS AMD loader, kept for parity
  mapCenter: { lat: number; lon: number };
  zoomLevel: number;
  mapDivId: string;

  private mapRef: any; // esri/Map
  private viewRef: any; // esri/views/MapView
  private symbolLayerPoint: any; // esri/layers/FeatureLayer
  private symbolLayerMultipoint: any; // esri/layers/FeatureLayer
  private symbolLayerLine: any; // esri/layers/FeatureLayer
  private symbolLayerPolygon: any; // esri/layers/FeatureLayer
  private inkLayer: any; // esri/layers/GraphicsLayer
  private inkLayerView: any; // esri/views/layers/GraphicsLayerView (not used for refresh)
  private drawing: boolean = false;
  private strokeStartTs: string = '';
  private strokeGraphic: any; // esri/Graphic (polyline)
  private assets: Map<string, Array<any>> = new Map();
  private nextObjectId: number = 1; // For unique objectid generation

  // Optional: allow overriding the military dictionary via portal item id
  private milDictionaryStyleUrl: string | null;
  private milDictionaryPortalItemId: string | null;

  constructor(apiKey: string | null, mapDivId: string, mapCenter: { lat: number; lon: number }, zoomLevel: number, options?: { mil2525StyleUrl?: string; mil2525PortalItemId?: string }) {
    this.apiKey = apiKey ?? null;
    this.mapDivId = mapDivId;
    this.mapCenter = mapCenter;
    this.zoomLevel = zoomLevel;
    // Renderer source can be provided as styleUrl or portalItem id; allow override via options and leave null by default to avoid bad URLs
    this.milDictionaryStyleUrl = options?.mil2525StyleUrl ?? null;
    this.milDictionaryPortalItemId = options?.mil2525PortalItemId ?? null;
  }

  load = async () => {
    const mapDiv = document.getElementById(this.mapDivId);
    if (!mapDiv) throw new Error(`Html page must contain a '#${this.mapDivId}' div`);

    return new Promise<void>((resolve, reject) => {
      try {
        require([
          'esri/Map',
          'esri/views/MapView',
          'esri/layers/FeatureLayer',
          'esri/renderers/DictionaryRenderer',
          'esri/layers/GraphicsLayer',
          'esri/Graphic',
          'esri/geometry/Point',
          'esri/geometry/Multipoint',
          'esri/geometry/Polyline',
          'esri/geometry/Polygon',
          'esri/geometry/projection',
          'esri/geometry/SpatialReference',
          'esri/config'
        ], (
          Map: any,
          MapView: any,
          FeatureLayer: any,
          DictionaryRenderer: any,
          GraphicsLayer: any,
          Graphic: any,
          Point: any,
          Multipoint: any,             
          Polyline: any,
          Polygon: any,
          projection: any,
          SpatialReference: any,
          esriConfig: any          
        ) => {
          // Apply API key if provided (required for Esri basemaps/services)
          if (this.apiKey && esriConfig) {
            esriConfig.apiKey = this.apiKey;
          }

          // Client-side feature layers for symbols using MIL-STD-2525 DictionaryRenderer
          // Note: fields array is optional for client-side layers; included for schema clarity
          // Field names match StpSymbol properties (using object directly, no flattening needed)
          const fields = [
            // Local layers require explicit setting of objectid
            { name: 'objectid', type: 'oid' },
            // Maps stpSYmbol's deeltaSIDC, whihc is a computed getter and is not directly accessible via 
            // fieldMap without this explicit property for renderer mapping
            { name: 'symbolId', type: 'string' },    
            // All StpSymbol properties are available since we use the object directly
            // Only defining the key ones used by fieldMap and commonly needed
            { name: 'poid', type: 'string' },
            { name: 'designator1', type: 'string' },     
            { name: 'parent', type: 'string' },         
            { name: 'echelon', type: 'string' },         
            { name: 'status', type: 'string' },          
            { name: 'affiliation', type: 'string' },     
            { name: 'modifier', type: 'string' },        
            { name: 'timeFrom', type: 'date' },          
            { name: 'timeTo', type: 'date' },            
            { name: 'minAltitude', type: 'double' },     
            { name: 'maxAltitude', type: 'double' },
            { name: 'description', type: 'string' },
            { name: 'fullDescription', type: 'string' }
          ];

          // Set url based on provided options (prioritize explicit ones)
          let dictionaryUrl;
          if (this.milDictionaryStyleUrl) {
            dictionaryUrl = this.milDictionaryStyleUrl;
            console.info('ArcGISMap: Using MIL-STD-2525 styleUrl:', dictionaryUrl);
          } else if (this.milDictionaryPortalItemId) {
            dictionaryUrl = this.milDictionaryPortalItemId;  // item ID string is acceptable
            console.info('ArcGISMap: Using MIL-STD-2525 portalItem ID:', dictionaryUrl);
          } else {
            // Fallback to MIL-STD-2525D with ordered anchor points support
            // Or Change 1: "f45922a0e20e4d3189a4099667bec656"
            dictionaryUrl = "https://www.arcgis.com/sharing/rest/content/items/d815f3bdf6e6452bb8fd153b654c94ca";
            console.info('ArcGISMap: Using default MIL-STD-2525D full URL:', dictionaryUrl);
          }

          // Renderer configuration with fieldMap tailored to StpSymbol properties
          const renderer = new DictionaryRenderer({
            url: dictionaryUrl, // symbolStyle: symbolStyle,
            fieldMap: {
              sidc: "symbolId", // Maps to StpSymbol.deltaSIDC
              uniquedesignation: "designator1", // Maps StpSymbol.designator1
              higherformation: "parent", // Maps StpSymbol.parent
              datetimevalid: "timeFrom", // Maps StpSymbol.timeFrom
              datetimeexpired: "timeTo", // Maps StpSymbol.timeTo
              z: "minAltitude", // Maps StpSymbol.minAltitude
              z2: "maxAltitude", // Maps StpSymbol.maxAltitude
            },
            config: {
              model: "ORDERED ANCHOR POINTS"  // Enables ordered anchor point interpretation for compatible symbols
            }
          });

          // Layers for different geometry types
          // Dummy point graphic for validation (use a neutral location, e.g., 0,0)
          const dummyPointGraphic = new Graphic({
            geometry: new Point({
              longitude: 0,
              latitude: 0,
              spatialReference: { wkid: 4326 }
            }),
            attributes: { objectid: 0 }  // Minimal required attribute
          });

          // For point layer
          this.symbolLayerPoint = new FeatureLayer({
            title: 'STP Symbols (Point)',
            source: [dummyPointGraphic],  // ← Add dummy
            fields,
            objectIdField: 'objectid',
            geometryType: 'point',
            spatialReference: { wkid: 4326 },
            renderer: renderer
          });

          // For multipoint layer (similar dummy, using Multipoint with one empty-ish point)
          const dummyMultipointGraphic = new Graphic({
            geometry: new Multipoint({
              points: [[0, 0]],
              spatialReference: { wkid: 4326 }
            }),
            attributes: { objectid: 0 }
          });

          this.symbolLayerMultipoint = new FeatureLayer({
            title: 'STP Symbols (Multipoint)',
            source: [dummyMultipointGraphic],  // ← Add dummy
            fields,
            objectIdField: 'objectid',
            geometryType: 'multipoint',
            spatialReference: { wkid: 4326 },
            renderer: renderer
          });          
          this.symbolLayerLine = new FeatureLayer({
            title: 'STP Symbols (Line)',
            source: [],
            fields,
            objectIdField: 'objectid',
            geometryType: 'polyline',
            spatialReference: { wkid: 4326 },
            renderer: renderer
          });
          this.symbolLayerPolygon = new FeatureLayer({
            title: 'STP Symbols (Area)',
            source: [],
            fields,
            objectIdField: 'objectid',
            geometryType: 'polygon',
            spatialReference: { wkid: 4326 },
            renderer: renderer
          });

          // Create map + view
          this.mapRef = new Map({ basemap: 'topo-vector' });
          this.viewRef = new MapView({
            container: mapDiv,
            map: this.mapRef,
            center: [this.mapCenter.lon, this.mapCenter.lat],
            zoom: this.zoomLevel,
            constraints: { snapToZoom: false }
          });


          this.viewRef.when(() => {
            // Ink layer for freehand drawing
            this.inkLayer = new GraphicsLayer({ title: 'Ink' });
            console.debug('InkLayer created:', this.inkLayer);  // Should log a valid object
            this.mapRef.add(this.inkLayer);  // Add immediately - no need for function check
            console.debug('InkLayer created and added to map');
            // 2. Immediately request the layer view and cache it
            this.viewRef.whenLayerView(this.inkLayer).then((layerView) => {
              this.inkLayerView = layerView;
              console.debug('InkLayerView is now ready');
            }).catch(err => {
              console.error('Failed to obtain inkLayerView:', err);
            });
            // Cursor hint similar to other adapters
            const container = this.viewRef.container as HTMLElement;
            if (container && container.style) container.style.cursor = 'crosshair';
            // Load projection module for coordinate transformations
            projection.load();
            // Symbol layers
            this.mapRef.addMany([this.symbolLayerPoint, this.symbolLayerMultipoint, this.symbolLayerLine, this.symbolLayerPolygon]);
            // Suppress panning during drags
            this.viewRef.on("drag", (event: any) => {
              event.stopPropagation();
            });
          });

          // Basic click selection support via hitTest
          this.viewRef.on('click', async (event: any) => {
            try {
              const response = await this.viewRef.hitTest(event);
              const graphic = response?.results?.find((r: any) => {
                const lyr = r.graphic?.layer;
                return lyr === this.symbolLayerPoint || lyr === this.symbolLayerLine || lyr === this.symbolLayerPolygon;
              })?.graphic;
              if (graphic && this.onSelection) {
                // graphic.attributes IS the StpSymbol object directly
                this.onSelection.call(this, graphic.attributes);
              }
            } catch (_) {
              /* ignore */
            }
          });

          // Freehand drawing
          this.viewRef.on('pointer-down', (e: any) => {
            if (e.button !== 0) return; // left button only
            // Prevent the default pan/zoom behavior
            e.stopPropagation();
            e.preventDefault();         // often both are needed for reliability
            this.drawing = true;
            this.strokeStartTs = this.getIsoTimestamp();
            const mapPoint = this.viewRef.toMap({ x: e.x, y: e.y });
            const start = { lat: mapPoint.latitude, lon: mapPoint.longitude };
            this.onStrokeStart?.call(this, start, this.strokeStartTs);
            //this.clearInk();

            const polyline = new Polyline({
                paths: [[[mapPoint.longitude, mapPoint.latitude]]],  // Initial path with first point
                spatialReference: { wkid: 4326 }
              });
            this.strokeGraphic = new Graphic({
              geometry: polyline,
              symbol: { type: 'simple-line', color: '#8B0000', width: 2 }
            });
            this.inkLayer.add(this.strokeGraphic);
            console.debug('Stroke started, initial path:', polyline.paths);          
          });

          this.viewRef.on('pointer-move', (e: any) => {
            if (!this.drawing || !this.strokeGraphic) return;
            e.stopPropagation();      // prevents any other move handlers from interfering
            const mapPoint = this.viewRef.toMap({ x: e.x, y: e.y });
            
            // Get current paths and add new point
            const currentGeom = this.strokeGraphic.geometry;
            const currentPaths = currentGeom.paths || [[]];
            const updatedPaths = [...currentPaths];
            updatedPaths[0] = [...(updatedPaths[0] || []), [mapPoint.longitude, mapPoint.latitude]];
            
            // Create new geometry object (don't mutate in place)
            const newGeometry = new Polyline({
              paths: updatedPaths,
              spatialReference: { wkid: 4326 }
            });
            
            // Update the graphic's geometry
            this.strokeGraphic.geometry = newGeometry;
            console.debug('Stroke move, path length:', updatedPaths[0].length);
          });

          const finish = (e: any) => {
            if (!this.drawing) return;
            this.drawing = false;
            const strokeEnd = this.getIsoTimestamp();
            const geom = this.strokeGraphic?.geometry;
            
            let coords: Array<{ lat: number; lon: number }> = [];
            if (geom?.paths?.[0]?.length > 0) {
              coords = geom.paths[0].map((p: any) => ({ lat: p[1], lon: p[0] }));
            }
            if (coords.length === 1) coords.push(coords[0]);

            const extent = this.viewRef?.extent;
            const mapDivEl = document.getElementById(this.mapDivId) as HTMLElement;
            const sizePixels = { width: mapDivEl.clientWidth, height: mapDivEl.clientHeight };
            
            const { topLeft, bottomRight } = this.convertExtentToWGS84(extent, Point, SpatialReference, projection);

            this.onStrokeCompleted?.call(this, sizePixels, topLeft, bottomRight, coords, this.strokeStartTs, strokeEnd, []);
          };
          this.viewRef.on('pointer-up', finish);
          document.addEventListener('mouseup', finish);

          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  addFeature = (symbolGeoJSON: any) => {
    if (!symbolGeoJSON) return;
    require(['esri/Graphic', 'esri/geometry/Multipoint'], (Graphic: any, Multipoint: any) => {
      const geom = symbolGeoJSON.geometry;
      const stpSymbol = symbolGeoJSON.properties.symbol;  // StpSymbol instance

      const esriGeom = this.geoJSONToEsriGeometry(geom);
      if (!esriGeom) return;

      // Add ArcGIS-specific properties directly to StpSymbol object
      stpSymbol.objectid = this.nextObjectId++;
      // Resolve computed deltaSIDC property explicitly otherwise it is not accessible via fieldMap 
      // since it is a getter, and DictionaryRenderer requires a direct property for mapping
      stpSymbol.symbolId = stpSymbol.deltaSIDC;
      const addGraphic = (layerRef: any, graphic: any) => {
        layerRef.applyEdits({ addFeatures: [graphic] }).catch((e: any) => console.error('Failed to add feature:', e));
        // Store reference for later removal (using poid as key if available)
        if (stpSymbol.poid) {
          const arr = this.assets.get(stpSymbol.poid) || [];
          arr.push(graphic);
          this.assets.set(stpSymbol.poid, arr);
        }
      };

      const graphic = new Graphic({ geometry: esriGeom, attributes: stpSymbol });

      // Handle by geometry type
      if (esriGeom.type === 'point') {
        addGraphic(this.symbolLayerPoint, graphic);
      } else if (esriGeom.type === 'polyline') {
        addGraphic(this.symbolLayerLine, graphic);
      } else if (esriGeom.type === 'polygon') {
        addGraphic(this.symbolLayerPolygon, graphic);
      } else if (esriGeom.type === 'multipoint') {
        addGraphic(this.symbolLayerMultipoint, graphic); 
      }
    });
  };

  removeFeature = async (poid: string) => {
    if (!poid) return;
    try {
      const where = `poid = '${poid.replace(/'/g, "''")}'`;
      const layers = [this.symbolLayerPoint, this.symbolLayerMultipoint, this.symbolLayerLine, this.symbolLayerPolygon].filter(Boolean);
      for (const lyr of layers) {
        const q = lyr.createQuery();
        q.where = where;
        const res = await lyr.queryFeatures(q);
        if (res && res.features && res.features.length) {
          await lyr.applyEdits({ deleteFeatures: res.features });
        }
      }
      this.assets.delete(poid);
    } catch (e) {
      console.error('Failed to remove feature:', e);
    }
  };

  addPoly = (coords: Array<{ lat: number; lon: number }>, color = '#66cc00', weight = 2) => {
    if (!coords || coords.length === 0) return;
    require(['esri/Graphic', 'esri/geometry/Polyline'], (Graphic: any, Polyline: any) => {
      const path = coords.map(c => [c.lon, c.lat]);
      const polyline = new Polyline({ paths: [path], spatialReference: { wkid: 4326 } });
      this.inkLayer.add(new Graphic({ geometry: polyline, symbol: { type: 'simple-line', color, width: weight } }));
    });
  };

  getBounds = () => this.viewRef?.extent;

  displayInfo = (
    content: string,
    location: { lat: number; lon: number },
    handlers?: Array<{ selector: string; handler: (e: Event) => void; closeInfo?: boolean }>
  ) => {
    const node = document.createElement('div');
    node.innerHTML = content;
    this.viewRef.popup.open({ content: node, location: { latitude: location.lat, longitude: location.lon } });
    if (handlers && handlers.length) {
      for (let i = 0; i < handlers.length; i++) {
        const instance = node.querySelector(handlers[i].selector);
        if (instance && handlers[i].handler) {
          instance.addEventListener('click', (event: any) => {
            if (handlers[i].closeInfo) this.viewRef.popup.close();
            handlers[i].handler(event);
          });
        }
      }
    }
  };

  clearInk = () => {
    if (this.inkLayer) {
      this.inkLayer.removeAll();
      console.debug('Ink layer cleared successfully');
    } else {
      console.warn('clearInk called before inkLayer was initialized');
    }
    this.strokeGraphic = undefined;
  };

  private getIsoTimestamp = () => new Date().toISOString();

  private geoJSONToEsriGeometry = (geom: any) => {
    if (!geom) return null;
    const sr = { wkid: 4326 };
    switch (geom.type) {
      case 'Point':
        return { type: 'point', longitude: geom.coordinates[0], latitude: geom.coordinates[1], spatialReference: sr };
      case 'MultiPoint':
        return { type: 'multipoint', points: geom.coordinates.map((c: any) => [c[0], c[1]]), spatialReference: sr };
      case 'LineString':
        return { type: 'polyline', paths: [geom.coordinates.map((c: any) => [c[0], c[1]])], spatialReference: sr };
      case 'Polygon':
        return { type: 'polygon', rings: geom.coordinates[0].map((c: any) => [c[0], c[1]]), spatialReference: sr };
      default:
        return null;
    }
  };

  private convertExtentToWGS84 = (extent: any, Point: any, SpatialReference: any, projection: any) => {
    if (extent.spatialReference.wkid === 4326) {
      return {
        topLeft: { lat: extent.ymax, lon: extent.xmin },
        bottomRight: { lat: extent.ymin, lon: extent.xmax }
      };
    }
    
    try {
      const wgs84SR = new SpatialReference({ wkid: 4326 });
      const topLeftGeo = projection.project(new Point({
        x: extent.xmin, y: extent.ymax, spatialReference: extent.spatialReference
      }), wgs84SR) as any;
      const bottomRightGeo = projection.project(new Point({
        x: extent.xmax, y: extent.ymin, spatialReference: extent.spatialReference
      }), wgs84SR) as any;
      
      return {
        topLeft: { lat: topLeftGeo.y, lon: topLeftGeo.x },
        bottomRight: { lat: bottomRightGeo.y, lon: bottomRightGeo.x }
      };
    } catch (err) {
      console.error('Coordinate projection failed:', err);
      return {
        topLeft: { lat: extent.ymax, lon: extent.xmin },
        bottomRight: { lat: extent.ymin, lon: extent.xmax }
      };
    }
  };
}

(window as any).ArcGISMap = ArcGISMap;