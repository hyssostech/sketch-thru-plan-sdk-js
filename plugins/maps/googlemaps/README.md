# Simple mapping based on Google Maps


STP is map agnostic - any solution can be used as the underlying surface for sketching, provided that the latitude and longitude coordinates (in decimal degrees) of the sketches can be obtained.

In this sample, Google Maps is used as the mapping application, but that could be replaced by solutions based on a variety of alternatives (for example [Leaflet](https://leafletjs.com/), [OpenLayers](https://openlayers.org/), [ESRI ArcGIS](https://developers.arcgis.com/javascript/)).


STP requires two events to be raised when the user sketches: 

1. A pen down event that signals the start of a sketched gesture
2. The completed stroke that follows

For convenience, it is also useful to be able to detect when STP-placed features are selected, so that additional information or actions can be performed as a response.

While code in applications embedding the STP SDK will likely use different approaches, in this sample, Google Maps presentation and sketching are encapsulated in a class that handles the mapping logic, and invokes handlers when the events above take place. 

## Map initialization

Each mapping system will require its own particular initialization. In this sample, the constructor takes an API key, name of the html element containing the map, and initial center and zoom level. 

```javascript
/**
 * Construct a Google Maps object
 * @param apiKey API key to use
 * @param mapDivId Id of the HTML div where map is presented
 * @param mapCenter Coordinates of the center of the map region displayed on load
 * @param zoomLevel Zoom level of the map region displayed on load
 */
constructor(apiKey: string, mapDivId: string, mapCenter: LatLon, zoomLevel: number)
```

## Detecting pen down on stroke start

The pen down latitude and longitude location and the time (UTC in ISO-8601 format) are provided as parameters. Notice that the sample also starts speech recognition at the time a stroke is started (see additional details further down)

```javascript
/**
 * Event invoked when a stroke is just started
 * @param location Coordinates of the initial point
 * @param timestamp Time the first point was placed - UTC time in ISO-8601 format
 */
onStrokeStart: ((location: LatLon, timestamp: string) => void) | undefined;
```

## Detecting a full stroke

Once the stroke is completed (on pen up), the full stroke is sent to STP for processing. Parameters provide the viewport
in coordinates and pixels, the stroke coordinates, start and end times, and unique identification of the symbols
the sketch crossed/touched.


```javascript
/**
 * Optional event invoked when a stroke has been completed
 * @param pixelBoundsWindow Bounds of the map window in pixels
 * @param topLeftGeoMap Top, left coordinate of the map extent
 * @param bottomRightGeoMap Bottom, right coordinate of the map extent
 * @param strokePoints Coordinates of the stroke
 * @param timeStrokeStart Stroke start time 
 * @param timeStrokeEnd Stroke end time
 * @param intersectedPoids Unique ids of the symbols that the stroke crossed/touched
 */
onStrokeCompleted: ((
    pixelBoundsWindow: Size,
    topLeftGeoMap: LatLon,
    bottomRightGeoMap: LatLon,
    strokePoints: LatLon[],
    timeStrokeStart: string,
    timeStrokeEnd: string,
    intersectedPoids: string[]
) => void) | undefined;
```

STP supports symbol editing by sketching a mark over a symbol and then speaking a value of a property of that symbol, 
for example, "echelon platoon" to set or change a unit's echelon. Other edits are also supported, for example speaking "delete this" to remove a symbol, or "move here", while sketching a line that starts inside a symbol and ends in the desired new position.

In order to support that, client apps are required to identify the symbols that are currently on display that get intersected by a stroke. 
The `intersectedPoids` parameter provides the collection of unique Ids of the overlapped symbols, or null if none.

Determining which symbols, if any, a stroke intersects depends on the visual rendition of the symbol on a particular client interface.
STP is able to reason about geolocation of symbols that have been created, but it is not able to determine their pixel outlines,
as different apps render the same symbols differently (at least from a size perspective).

In this series of samples, this information is _not_ being captured. AS a result, edit commands are not supported by the existing samples.


## Handling map symbol clicks

In this sample, selection causes the properties of the symbol to be displayed (in an infowindow/popup) that includes a `delete` button. 

```javascript
/**
 * Event invoked when a feature is selected
 * @param symbol STP symbol that was selected
 */
onSelection: ((symbol: StpSymbol) => void) | undefined;
```

## Loading the map

After the handlers above have been configured, the map is loaded.

```javascript
/**
 * Load google maps, linking to our initialization callback
 * See https://www.npmjs.com/package/@googlemaps/js-api-loader 
 */
load(): void;
```
## Adding and removing features

The `addFeature` and `removeFeature` methods get GeoJSON representations of the symbols placed on the map and removed.

```javascript
/**
 * Add feature representing a symbol to the map
 * @param symbol Symbol GeoJSON to add
 */
addFeature(symbolGeoJSON: GeoJSON.Feature): void;
/**
 * Remove a feature from the map
 * @param poid Unique identifier of the feature to remove
 */
removeFeature(poid: string): void;
```

## Other display methods 

Popup display of symbol properties (as an html string) are provided by `displayInfo`.

```javascript
/**
 * Display an information window/popup on the map
 * @param content HTML content to display
 * @param location Coordinates of the location where the content is to be displayed
 * @param handlers Optional array of CSS selectors and corresponding functions to activate if the element is selected (button/link clicked)
 */
displayInfo(content: string, location: LatLon, handlers: InfoHandlers[]): void;
```

As users sketch, the strokes they place remain visible to provide feedback. STP sends notifications that 
indicate when the strokes have been processed and can be removed from the display to reduce clutter.

```javascript
/**
 * Remove gesture ink from the map, if any
 */
clearInk(): void;
```
