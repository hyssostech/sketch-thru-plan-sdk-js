# Adding military symbols to Google Maps or Leaflet via Speech and Sketch (Edit Sample)

This unified sample extends the quickstart demonstration of Sketch‑Thru‑Plan sketch and speech creation of military plans, replacing the generic placeholder rendering with standard 2525 symbology. Unlike the single‑adapter samples, this page lets you choose between Google Maps and Leaflet at load time.

## Prerequisites
* Sketch‑thru‑Plan (STP) Engine (v5.9.9+) running on an accessible server
* For Google Maps: a [Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key)
* A subscription key for Microsoft's Azure [Speech service](https://docs.microsoft.com/azure/cognitive-services/speech-service/get-started)
* A PC or Mac with a working microphone

## Script external references

Three cdn libraries are referenced in [index.html](index.html):

1. Microsoft's Cognitive Services Speech SDK – used by the speech plugin
1. STP SDK itself – available on jsDelivr
1. The Azure Speech plugin

The `JmsRenderer` bundle is included locally and provides single‑point SVG and multipoint rendering.

## Configuration

Enter servers and keys by editing [index.js](index.js), or supply them via querystring.

* STP WebSockets server address and port:

```javascript
const webSocketUrl  = "ws://<STP server>:<STP port>";
```

* If using Google Maps, provide your API key (or via `mapkey` querystring):

```javascript
const googleMapsKey = "<Enter your Google Maps API key here>";
```

* Azure Speech configuration:

```javascript
const azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
const azureServiceRegion = "<Enter Azure's subscription region>"; 
const azureLanguage = "en-US";
```

* Default location and zoom:

```javascript
const mapCenter = { lat: 58.967774948, lon: 11.196062412 };
const zoomLevel = 13;
```

## Choosing the map adapter

You can select the adapter in two ways:

- Dropdown at the top of the page (reloads with your choice)
- Querystring parameter `map=gmaps|leaflet`

When `gmaps` is selected, the Google Maps loader and the Google Maps adapter bundle are loaded. When `leaflet` is selected, Leaflet CSS/JS and the Leaflet adapter bundle are loaded. Only the chosen adapter’s scripts are injected to keep the page light.

## Run the sample
Open the page in a browser. You may need to serve the page from an HTTP server (rather than `file:`) to avoid browser restrictions.

Optional querystring parameters:

- `map` – `gmaps` or `leaflet` (default `gmaps`)
- `mapkey` – Google Maps API key (required for `gmaps` in some environments)
- `lat`, `lon` – coordinates of the center of the map (decimal degrees)
- `zoom` – initial map zoom level
- `azkey` – MS Cognitive Services Speech API key
- `azregion` – MS Cognitive Services Speech instance region
- `azlang` – MS Cognitive Services Speech language (default is en‑US)
- `azendp` – Optional MS Cognitive Services Speech custom language model endpoint
- `stpurl` – STP WebSockets URL
- `inkonly` – prevents browser speech recognition (only ink is sent)
- `machineid` – pairs ink with an external speech recognizer on the same machine

Example:

```
edit/index.html?map=leaflet&lat=58.9&lon=11.19&zoom=13&stpurl=ws://localhost:3000
```

## Speech

This sample uses a “while sketching” speech approach. Recognition is enabled at the beginning of a user sketch and deactivated 5 seconds after the sketch ends. See [index.js](index.js) for event wiring (`onRecognized`, `onRecognizing`, `onError`).

## Rendering

Rendering code is provided by the `JmsRenderer` bundle, which enriches the base GeoJSON from STP (`symbol.asGeoJSON()`) with:

- Single‑point SVG icons via Spatial Illusions `milsymbol`
- Multipoint tactical graphics via Mission Command `mil‑sym‑js`

In [index.js](index.js), symbols are added/updated using:

```javascript
const gj = new JmsRenderer(alternates[0], map.getBounds()).asGeoJSON();
map.addFeature(gj);
```

The references to these renderers are included through the local JMS bundle.

## Symbol properties

STP provides a rich set of properties on each symbol and its location. If you switch to a different renderer, map STP properties to your renderer’s inputs. See the single‑adapter readmes for detailed property tables.

