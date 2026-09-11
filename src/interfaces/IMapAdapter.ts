export interface IMapAdapter {
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
  apiKey: string | null;
  mapCenter: { lat: number; lon: number };
  zoomLevel: number;
  mapDivId: string;

  // Lifecycle
  load: () => Promise<void>;

  // Feature operations
  addFeature: (symbolGeoJSON: any) => void;
  removeFeature: (poid: string) => void;
  addPoly: (coords: Array<{ lat: number; lon: number }>, color?: string, weight?: number) => void;
  getBounds: () => any;

  // UI helpers
  displayInfo: (
    content: string,
    location: { lat: number; lon: number },
    handlers?: Array<{ selector: string; handler: (e: Event) => void; closeInfo?: boolean }>
  ) => void;
  clearInk: () => void;
}
