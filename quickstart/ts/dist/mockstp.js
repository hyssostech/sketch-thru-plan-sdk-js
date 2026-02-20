export class MockRecognizer {
    async connect(serviceName, timeout, machineId) {
        this.onStpMessage?.(`Connected to mock STP (${serviceName || "Mock"})`, "Info");
    }
    async disconnect(timeout) {
        this.onStpMessage?.("Disconnected from mock STP", "Info");
    }
    sendPenDown(location, timestamp) { }
    sendInk(pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids) {
        this.onInkProcessed?.();
        const poid = `mock-${Date.now()}`;
        const isPoint = strokePoints && strokePoints.length <= 2;
        const centroid = isPoint ? strokePoints[0] : strokePoints[Math.floor(strokePoints.length / 2)];
        const symbol = new MockSymbol(poid, centroid, strokePoints, isPoint ? "point" : "line");
        symbol.affiliation = "friend";
        symbol.fullDescription = isPoint ? "Mock Point" : "Mock Graphic";
        symbol.description = symbol.fullDescription;
        this.onSymbolAdded?.([symbol], false);
    }
    sendSpeechRecognition(results, startTime, endTime) {
        const phrases = (results || []).map(r => r.text);
        this.onSpeechRecognized?.(phrases);
    }
    deleteSymbol(poid) { this.onSymbolDeleted?.(poid, false); }
}
class MockSymbol {
    constructor(poid, centroid, coords, shape) {
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
//# sourceMappingURL=mockstp.js.map