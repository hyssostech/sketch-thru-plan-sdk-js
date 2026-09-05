/**
 * Minimal mock STP recognizer to run quickstart without a backend.
 */
class MockRecognizer {
  // Event handlers (set by app)
  onSymbolAdded;
  onSymbolModified;
  onSymbolDeleted;
  onInkProcessed;
  onSpeechRecognized;
  onStpMessage;

  constructor() {
    this._lastPenDown = null;
  }

  async connect(serviceName, timeout) {
    this.onStpMessage?.("Connected to mock STP (" + (serviceName || "Mock") + ")", "Info");
    return "mock-session";
  }

  async disconnect() {
    this.onStpMessage?.("Disconnected from mock STP", "Info");
  }

  // Pen down
  sendPenDown(location, timestamp) {
    this._lastPenDown = { location, timestamp };
  }

  // Ink processing → simulate a symbol result and ink processed
  sendInk(pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids) {
    // Notify ink processed
    this.onInkProcessed?.();

    // Build a simple symbol from the stroke
    const poid = "mock-" + Date.now();
    const isPoint = strokePoints && strokePoints.length <= 2;
    const centroid = isPoint ? strokePoints[0] : strokePoints[Math.floor(strokePoints.length / 2)];
    const symbol = new MockSymbol(poid, centroid, strokePoints, isPoint ? "point" : "line");
    symbol.affiliation = "friend";
    symbol.fullDescription = isPoint ? "Mock Point" : "Mock Graphic";
    symbol.description = symbol.fullDescription;

    // Emit symbol added
    this.onSymbolAdded?.([symbol], false);
  }

  // Speech result passthrough
  sendSpeechRecognition(results, startTime, endTime) {
    const phrases = (results || []).map(r => r.text || String(r));
    this.onSpeechRecognized?.(phrases);
  }

  // Delete symbol by id
  deleteSymbol(poid) {
    this.onSymbolDeleted?.(poid, false);
  }
}

class MockSymbol {
  constructor(poid, centroid, coords, shape) {
    this.poid = poid;
    this.location = {
      fsTYPE: shape === "point" ? "point" : "line",
      shape: shape,
      centroid: centroid,
      coords: coords || []
    };
    this.affiliation = "unknown";
    this.fullDescription = "Mock Symbol";
    this.description = this.fullDescription;
    this.sidc = { partA: "", partB: "", symbolSet: "", legacy: "" };
  }

  // Provide a basic GeoJSON envelope that BasicRenderer will adjust
  asGeoJSON() {
    const isPoint = this.location.fsTYPE === "point";
    const feature = {
      type: "Feature",
      id: this.poid,
      properties: {
        poid: this.poid,
        symbol: this,
        description: this.description,
        affiliation: this.affiliation
      },
      geometry: isPoint
        ? { type: "Point", coordinates: [this.location.centroid.lon, this.location.centroid.lat] }
        : { type: "LineString", coordinates: (this.location.coords || []).map(p => [p.lon, p.lat]) }
    };
    return feature;
  }
}
