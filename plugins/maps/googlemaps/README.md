# Google Maps Adapter

This adapter wires Sketch‑thru‑Plan (STP) events and feature rendering to Google Maps.

## Prerequisites

- Google Maps JavaScript API loader: `@googlemaps/js-api-loader`

## Usage (Browser)

```html
<!-- Google Maps loader -->
<script src="https://unpkg.com/@googlemaps/js-api-loader@1.x/dist/index.min.js"></script>
<!-- STP Google Maps adapter bundle -->
<script src="../../plugins/maps/googlemaps/dist/googlemaps-bundle.js"></script>
```

```javascript
// Instantiate and wire events
const mapCenter = { lat: 38.9, lon: -77.0 };
const map = new GoogleMap('<API_KEY>', 'map', mapCenter, 10);

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

// Initialize Google Maps
map.load();

// Core operations
// map.addFeature(geojsonFeature);
// map.removeFeature(poid);
// map.displayInfo(html, { lat, lon }, [{ selector: '#btn', handler: () => {} }]);
// map.clearInk();
```

## Bundles

- UMD: [plugins/maps/googlemaps/dist/googlemaps-bundle.js](plugins/maps/googlemaps/dist/googlemaps-bundle.js)
- Minified: [plugins/maps/googlemaps/dist/googlemaps-bundle-min.js](plugins/maps/googlemaps/dist/googlemaps-bundle-min.js)
- ESM: [plugins/maps/googlemaps/dist/googlemaps-bundle.esm.js](plugins/maps/googlemaps/dist/googlemaps-bundle.esm.js)
- Types: [plugins/maps/googlemaps/dist/googlemaps-bundle.d.ts](plugins/maps/googlemaps/dist/googlemaps-bundle.d.ts)

## Sample

See [samples/gmaps/index.html](samples/gmaps/index.html) for a complete integration example.
