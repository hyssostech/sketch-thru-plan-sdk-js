# Adding military symbols to Google Maps, Leaflet, or ArcGIS via Speech and Sketch (Edit Sample)

This unified sample extends the quickstart demonstration of Sketch‑Thru‑Plan sketch and speech creation of military plans, replacing the generic placeholder rendering with standard 2525 symbology. Unlike the single‑adapter samples, this page lets you choose between Google Maps, Leaflet, and ArcGIS at load time.

## Prerequisites
* Sketch‑thru‑Plan (STP) Engine (v5.10+) running on an accessible server
* For Google Maps: a [Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key)
* For ArcGIS: optionally an [ArcGIS API key](https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/) (public basemaps work without one)
* For Azure speech: a subscription key for Microsoft's Azure [Speech service](https://docs.microsoft.com/azure/cognitive-services/speech-service/get-started)
* For Vosk speech (offline): extract the included model (see [Vosk setup](#vosk-offline-speech-setup) below)
* A PC or Mac with a working microphone

## Script external references

Three cdn libraries are referenced in [index.html](index.html):

1. Microsoft's Cognitive Services Speech SDK – used by the Azure speech plugin
1. STP SDK itself – available on jsDelivr
1. The Azure Speech plugin

The Vosk speech plugin and its WASM runtime (`vosk.js`) are loaded from the local plugin build output. The AWS speech plugin bundle is also loaded locally.

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
- Querystring parameter `map=gmaps|leaflet|arcgis`

When `gmaps` is selected, the Google Maps loader and the Google Maps adapter bundle are loaded. When `leaflet` is selected, Leaflet CSS/JS and the Leaflet adapter bundle are loaded. When `arcgis` is selected, the ArcGIS JS API 4.29, its CSS, and the ArcGIS adapter bundle are loaded. Only the chosen adapter's scripts are injected to keep the page light.

## Run the sample
Open the page in a browser. You may need to serve the page from an HTTP server (rather than `file:`) to avoid browser restrictions.

Optional querystring parameters:

- `map` – `gmaps`, `leaflet`, or `arcgis` (default `gmaps`)
- `mapkey` – Google Maps API key (required for `gmaps` in some environments)
- `arcgiskey` – ArcGIS API key (optional; public basemaps work without one)
- `lat`, `lon` – coordinates of the center of the map (decimal degrees)
- `zoom` – initial map zoom level
- `azkey` – MS Cognitive Services Speech API key
- `azregion` – MS Cognitive Services Speech instance region
- `azlang` – MS Cognitive Services Speech language (default is en‑US)
- `azendp` – Optional MS Cognitive Services Speech custom language model endpoint
- `awskey` – AWS Access Key ID
- `awssecret` – AWS Secret Access Key
- `awstoken` – Optional AWS session token (for temporary credentials)
- `awsregion` – AWS region (default `us-east-1`)
- `awslang` – AWS Transcribe language (default `en-US`)
- `speech` – Speech provider: `azure`, `aws`, or `vosk` (default `azure`)
- `voskmodel` – Path to the extracted Vosk model directory (default `./model`)
- `stpurl` – STP WebSockets URL
- `inkonly` – prevents browser speech recognition (only ink is sent)
- `machineid` – pairs ink with an external speech recognizer on the same machine

Example:

```
edit/index.html?map=leaflet&lat=58.9&lon=11.19&zoom=13&stpurl=ws://localhost:3000
```

ArcGIS example:

```
edit/index.html?map=arcgis&lat=58.9&lon=11.19&zoom=13&stpurl=ws://localhost:3000
```

## Speech

This sample uses a “while sketching” speech approach. Recognition is enabled at the beginning of a user sketch and deactivated 5 seconds after the sketch ends. See [index.js](index.js) for event wiring (`onRecognized`, `onRecognizing`, `onError`).### Vosk (offline) speech setup

The Vosk plugin uses a domain-adapted speech model that runs entirely in the browser via WebAssembly. No cloud service or API keys are needed.

**One-time setup**: extract the model from the included zip into this sample's directory:

```powershell
# PowerShell (from the repo root)
Expand-Archive -Path plugins/speech/voskspeech-plugin/model/vosk-model-la-domain.zip -DestinationPath samples/basic/model
```

```bash
# bash / macOS / Linux (from the repo root)
unzip plugins/speech/voskspeech-plugin/model/vosk-model-la-domain.zip -d samples/basic/model
```

After extraction, `samples/basic/model/` should contain the `am/`, `conf/`, `graph/`, and `ivector/` subdirectories (~50 MB total).

Then select **Vosk (offline)** from the Speech dropdown, or use `?speech=vosk` in the querystring.

> **Note**: The page must be served over HTTPS for microphone access. The Vosk plugin also requires the `vosk-processor.js` AudioWorklet, which is loaded automatically from the plugin directory.
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

**ArcGIS note:** When using the ArcGIS adapter, the `JmsRenderer` is bypassed. The ArcGIS plugin uses its own `DictionaryRenderer` with MIL‑STD‑2525D to render symbols natively, so `symbol.asGeoJSON()` is passed directly to `map.addFeature()`.

## Programmatic symbol manipulation

The SDK exposes methods that let applications programmatically add, update, and delete symbols outside of the normal sketch‑and‑speech flow.
All of these are *requests* – the application should wait for the corresponding STP event before updating its own state.

| Method | Description |
|---|---|
| `addSymbol(symbol)` | Request that a new symbol be added. STP responds with `onSymbolAdded`. |
| `updateSymbol(poid, symbol)` | Request that an existing symbol be modified. STP responds with `onSymbolModified`. |
| `deleteSymbol(poid)` | Request that a symbol be removed. STP responds with `onSymbolDeleted`. |
| `chooseAlternate(poid, nBestIndex)` | Select a different recognition alternate for a symbol. |

### Symbol events

Wire these handlers to keep the map display in sync with STP:

```javascript
// A new symbol has been recognized – render the top alternate
stpsdk.onSymbolAdded = (alternates, isUndo) => {
  const gj = new JmsRenderer(alternates[0], map.getBounds()).asGeoJSON();
  map.addFeature(gj);
};

// An existing symbol was modified – replace it on the map
stpsdk.onSymbolModified = (poid, symbol, isUndo) => {
  map.removeFeature(poid);
  const gj = new JmsRenderer(symbol, map.getBounds()).asGeoJSON();
  map.addFeature(gj);
};

// A symbol was deleted – remove it from the map
stpsdk.onSymbolDeleted = (poid, isUndo) => {
  map.removeFeature(poid);
};
```

Each handler receives an `isUndo` flag that is `true` when the event is the result of an undo/redo operation, allowing the UI to distinguish user‑initiated changes from history‑based ones.

### Deleting a symbol on selection

In this sample, clicking a rendered symbol opens an info popup that includes a **Delete** button.
The button calls `deleteSymbol` with the symbol's unique identifier; the actual removal happens when STP fires `onSymbolDeleted`:

```javascript
map.onSelection = (symbol) => {
  map.displayInfo(
    buildInfo(symbol),
    symbol.location.centroid,
    [{ selector: '#delButton',
       handler: () => { stpsdk.deleteSymbol(symbol.poid); },
       closeInfo: true }]
  );
};
```
## Symbol properties

STP provides a rich set of properties on each symbol and its location. If you switch to a different renderer, map STP properties to your renderer's inputs. See also the [renderers README](../../plugins/renderers/README.md) for additional context.

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Symbol type: unit, mootw, equipment, tg, task                                |
| poid              | STP unique identifier                                                        |
| parentCoa         | Unique id of the COA this symbol belongs to                                  |
| creatorRole       | Role that created the symbol: S2, S3, S4, Eng, FSO                          |
| interval          | Symbol creation time interval                                                |
| confidence        | Confidence score of the recognition (1.0 is 100%)                            |
| alt               | Rank of this symbol interpretation amongst the interpretation hypotheses     |
| sidc.partA        | Part A of the 2525D id                                                       |
| sidc.partB        | Part B of the 2525D id                                                       |
| sidc.partC        | Part C of the 2525D id                                                       |
| sidc.symbolSet    | 2525D Symbol Set                                                             |
| sidc.legacy       | 2525C SIDC                                                                   |
| location          | Location of the symbol (see sub‑properties below)                            |
| shortDescription  | Just the essential distinguishing elements, e.g. designators                 |
| description       | Name/type of the symbol plus designators, but may omit "friendly", "present" and other assumed decorators |
| fullDescription   | Complete description, including affiliation, status and all decorators        |
| affiliation       | pending, unknown, assumedfriend, friend, neutral, suspected, hostile         |
| echelon           | none, team, squad, section, platoon, company, battalion, regiment, brigade, division, corps, army, armygroup, region, command |
| parent            | Parent unit designator                                                       |
| designator1       | Main symbol designator                                                       |
| designator2       | Additional designator, e.g. in a company boundary, indicating the designator of the company to the S or E |
| status            | present, anticipated                                                         |
| modifier          | HQ and Task Force modifier: none, dummy, hq, dummy_hq, task_force, dummy_task_force, task_force_hq, dummy_task_force_hq |
| strength          | none, reduced, reinforced, reduced_reinforced                                |
| branch            | weapon, ground_unit, civilian_air, special_operations, vstol, equipment, installation, military_air, military_sea, military_submarine |
| timeFrom          | Start time, e.g. of a Restricted Operations Zone                            |
| timeTo            | End time, e.g. of a Restricted Operations Zone                              |
| altitude          | Altitude parameter, if applicable                                            |
| minAltitude       | Symbol minimal altitude if a range is supported                              |
| maxAltitude       | Symbol maximal altitude if a range is supported                              |
| toUnitPoid        | For symbols created from a Task Org, the unique id of the Task Org Unit that this symbol was created from |

### Location properties

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Location type: point, line, area                                             |
| width             | Location width, if applicable                                                |
| shape             | Gesture type, normally point, line or area. Other types include straightline, arrowthin, arrowfat, hook, ubend, ubendthreepoints, vee, opencircle, multipoint |
| radius            | Radius of the area containing the symbol, if applicable (zero for point locations) |
| coords            | Array of `{ lat, lon }` coordinates                                          |
| centroid          | Coordinates of the location centroid `{ lat, lon }`                          |
| candidatePoids    | Unique Ids of the symbols intersected by coords (used for editing operations that use sketches to select objects) |

