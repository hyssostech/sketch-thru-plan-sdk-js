# Map Adapters

Sketch‑thru‑Plan (STP) is map‑agnostic: any mapping library can be used as the sketching surface as long as latitude/longitude coordinates (decimal degrees) are available for user input and feature placement. This folder provides adapters that wire common sketching and selection events and render STP features on the chosen map.

Core responsibilities expected of any adapter:

- Pen‑down event: fired at the start of a gesture with location and timestamp.
- Stroke‑completed event: fired on pen‑up with viewport info and full stroke coordinates.
- Selection event: fired when a rendered feature is selected to drive UI actions (e.g., show info, delete).
- Feature rendering: add/remove STP features as GeoJSON; display contextual info; clear sketch ink when notified.

Note on edits by sketch: to support voice‑driven edits (e.g., “delete this”, “move here”), clients should identify which on‑screen features a stroke intersects. Samples currently do not compute pixel hit‑testing; therefore edit commands are not enabled out of the box.

## Available Plugins

- Google Maps adapter: see [googlemaps](googlemaps)

- Leaflet adapter: see [leaflet](leaflet)

- ArcGIS adapter: see [arcgis](arcgis)

The [basic](../../samples/basic) sample demonstrates the use of Leaflet and Google Maps adapters, and provides the ability for users to switch from one to another at runtime. The [arcgis](../../samples/arcgis) samples demonstrate the use of the third adapter. 


---

## Generic Adapter API

Both adapters expose a consistent shape for common operations: initialize/load the map, subscribe to sketch/selection events, `addFeature`, `removeFeature`, `displayInfo`, and `clearInk`. Choose the adapter that matches your mapping library, or implement your own following the same event and rendering contract.

The following API applies to all mapping adapters. Concrete implementations may add library‑specific parameters, but the event shapes and core methods remain consistent.

### Initialization

Construction and initialization differ by mapping provider (e.g., loader scripts, CSS/JS, API keys, and constructor signatures). This README documents the common event and method contract only. See each plugin’s README for concrete setup and initialization details:

- [googlemaps/README.md](googlemaps/README.md)
- [leaflet/README.md](leaflet/README.md)
- [arcgis/README.md](arcgis/README.md)

### Detecting pen down on stroke start

Fired when a gesture begins. The latitude/longitude and the UTC timestamp (ISO‑8601) are provided.

```javascript
/**
 * Event invoked when a stroke is just started
 * @param location Coordinates of the initial point
 * @param timestamp Time the first point was placed - UTC ISO-8601
 */
map.onStrokeStart = (location, timestamp) => {
    // Start speech recognition, UI feedback, etc.
};
```

### Detecting a full stroke

Fired on pen‑up. Provides viewport coordinates/pixels, the full stroke, start/end times, and ids of intersected symbols (if determined by the client).

```javascript
/**
 * Optional event invoked when a stroke has been completed
 * @param pixelBoundsWindow Bounds of the map window in pixels
 * @param topLeftGeoMap Top, left coordinate of the map extent
 * @param bottomRightGeoMap Bottom, right coordinate of the map extent
 * @param strokePoints Coordinates of the stroke
 * @param timeStrokeStart Stroke start time
 * @param timeStrokeEnd Stroke end time
 * @param intersectedPoids Unique ids of symbols that the stroke crossed/touched
 */
map.onStrokeCompleted = (
    pixelBoundsWindow,
    topLeftGeoMap,
    bottomRightGeoMap,
    strokePoints,
    timeStrokeStart,
    timeStrokeEnd,
    intersectedPoids
) => {
    // Send stroke to STP for processing
};
```

#### Intersected Features (`intersectedPoids`)

The `intersectedPoids` array is critical for enabling edit‑by‑sketch workflows (e.g., “delete this”, “move here”, property changes via voice). It should contain the unique `poid` values of all features currently displayed that the stroke crosses or touches.

Implementation guidance:

- Pixel hit‑testing is map‑specific. When using renderers that provide hit‑shapes (e.g., JMS single‑point renderer emits a polygon in the `rendering` payload), use those polygons for precise intersection checks.
- For multipoint features, simple proximity or segment intersection tests against the stroke path are sufficient.
- If you cannot compute pixel hit‑testing, pass an empty array; edit commands will be disabled.

### Handling map symbol clicks

Fired when a rendered feature is selected (e.g., right‑click on marker or feature).

```javascript
/**
 * Event invoked when a feature is selected
 * @param symbol STP symbol that was selected
 */
map.onSelection = (symbol) => {
    // Display info, enable delete, etc.
};
```

### Loading the map

After handlers are configured, load the underlying map.

```javascript
/**
 * Load the map and initialize capture
 */
map.load();
```

### Adding and removing features

Adapters render STP symbols provided as GeoJSON features.

```javascript
/**
 * Add feature representing a symbol to the map
 * @param symbolGeoJSON Symbol GeoJSON to add
 */
map.addFeature(symbolGeoJSON);

/**
 * Remove a feature from the map
 * @param poid Unique identifier of the feature to remove
 */
map.removeFeature(poid);
```

### Displaying contextual information

Adapters can show popup/infowindow content and wire element handlers.

```javascript
/**
 * Display an information window/popup on the map
 * @param content HTML content to display
 * @param location Coordinates where the content is displayed
 * @param handlers Optional array of { selector, handler, closeInfo? }
 */
map.displayInfo(html, { lat, lon }, [
    { selector: '#delete', handler: () => {/* ... */}, closeInfo: true }
]);
```

### Clearing sketch ink

Clear the last freehand stroke once processed to reduce visual clutter.

```javascript
/**
 * Remove gesture ink from the map, if any
 */
map.clearInk();
```
