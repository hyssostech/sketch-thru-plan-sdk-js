# Leaflet Adapter

This adapter wires Sketch‑thru‑Plan (STP) events and feature rendering to Leaflet.

## Prerequisites

- Leaflet CSS/JS: `leaflet@1.9.x`

## Usage (Browser)

```html
<!-- Leaflet CSS/JS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<!-- STP Leaflet adapter bundle -->
<script src="../../plugins/maps/leaflet/dist/leaflet-bundle.js"></script>
```

```javascript
// Instantiate and wire events (apiKey unused; kept for parity)
const mapCenter = { lat: 38.9, lon: -77.0 };
const map = new LeafletMap(null, 'map', mapCenter, 10);

map.onStrokeStart = (location, timestamp) => {
  // Handle gesture start
};

map.onStrokeCompleted = (
  pixelBoundsWindow,
  topLeftGeoMap,
  bottomRightGeoMap,
  strokePoints,
  timeStrokeStart,
  timeStrokeEnd,
  intersectedPoids
) => {
  // Send stroke to STP
};

map.onSelection = (symbol) => {
  // Show info, enable delete, etc.
};

// Initialize Leaflet
map.load();

// Core operations
// map.addFeature(geojsonFeature);
// map.removeFeature(poid);
// map.displayInfo(html, { lat, lon }, [{ selector: '#btn', handler: () => {} }]);
// map.clearInk();
```

## Bundles

- UMD: [plugins/maps/leaflet/dist/leaflet-bundle.js](plugins/maps/leaflet/dist/leaflet-bundle.js)
- Minified: [plugins/maps/leaflet/dist/leaflet-bundle-min.js](plugins/maps/leaflet/dist/leaflet-bundle-min.js)
- ESM: [plugins/maps/leaflet/dist/leaflet-bundle.esm.js](plugins/maps/leaflet/dist/leaflet-bundle.esm.js)
- Types: [plugins/maps/leaflet/dist/leaflet-bundle.d.ts](plugins/maps/leaflet/dist/leaflet-bundle.d.ts)

## Sample

See [samples/leaflet/index.html](samples/leaflet/index.html) for a complete integration example.
