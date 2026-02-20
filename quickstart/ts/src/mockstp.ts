import { LatLon, StpSymbol, Size } from "sketch-thru-plan-sdk";

export class MockRecognizer {
  onSymbolAdded: ((alternates: StpSymbol[], isUndo: boolean) => void) | undefined;
  onSymbolModified: ((poid: string, symbol: StpSymbol, isUndo: boolean) => void) | undefined;
  onSymbolDeleted: ((poid: string, isUndo: boolean) => void) | undefined;
  onInkProcessed: (() => void) | undefined;
  onSpeechRecognized: ((phrases: string[]) => void) | undefined;
  onStpMessage: ((msg: string, level: string) => void) | undefined;

  async connect(serviceName: string, timeout?: number, machineId?: string | null): Promise<void> {
    this.onStpMessage?.(`Connected to mock STP (${serviceName || "Mock"})`, "Info");
  }

  async disconnect(timeout?: number): Promise<void> {
    this.onStpMessage?.("Disconnected from mock STP", "Info");
  }

  sendPenDown(location: LatLon, timestamp: string) { /* noop */ }

  sendInk(
    pixelBoundsWindow: Size,
    topLeftGeoMap: LatLon,
    bottomRightGeoMap: LatLon,
    strokePoints: LatLon[],
    timeStrokeStart: string,
    timeStrokeEnd: string,
    intersectedPoids: string[]
  ) {
    this.onInkProcessed?.();
    const poid = `mock-${Date.now()}`;
    const isPoint = strokePoints && strokePoints.length <= 2;
    const centroid = isPoint ? strokePoints[0] : strokePoints[Math.floor(strokePoints.length / 2)];
    const symbol = new MockSymbol(poid, centroid, strokePoints, isPoint ? "point" : "line");
    symbol.affiliation = "friend";
    symbol.fullDescription = isPoint ? "Mock Point" : "Mock Graphic";
    symbol.description = symbol.fullDescription;
    this.onSymbolAdded?.([symbol as unknown as StpSymbol], false);
  }

  sendSpeechRecognition(results: { text: string }[], startTime: string, endTime: string) {
    const phrases = (results || []).map(r => r.text);
    this.onSpeechRecognized?.(phrases);
  }

  deleteSymbol(poid: string) { this.onSymbolDeleted?.(poid, false); }
}

class MockSymbol {
  poid: string;
  location: { fsTYPE: string; shape: string; centroid: LatLon; coords: LatLon[] };
  affiliation: string;
  fullDescription: string;
  description: string;
  sidc: { partA?: string; partB?: string; symbolSet?: string; legacy?: string };

  constructor(poid: string, centroid: LatLon, coords: LatLon[], shape: string) {
    this.poid = poid;
    this.location = { fsTYPE: shape === "point" ? "point" : "line", shape, centroid, coords: coords || [] };
    this.affiliation = "unknown";
    this.fullDescription = "Mock Symbol";
    this.description = this.fullDescription;
    this.sidc = {};
  }

  asGeoJSON() {
    const isPoint = this.location.fsTYPE === "point";
    return {
      type: "Feature",
      id: this.poid,
      properties: { poid: this.poid, symbol: this, description: this.description, affiliation: this.affiliation },
      geometry: isPoint
        ? { type: "Point", coordinates: [this.location.centroid.lon, this.location.centroid.lat] }
        : { type: "LineString", coordinates: (this.location.coords || []).map(p => [p.lon, p.lat]) }
    };
  }
}
