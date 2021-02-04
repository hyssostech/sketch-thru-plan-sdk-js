# Adding military symbols to Google Maps via Speech and Sketch

This sample extends the [quickstart](../../qs/js) demonstration os Sketch-Thru-Plan sketch and speech creation of military plans, replacing the generic placeholder rendering with standard 2525 symbology.

## Prerequisites
* Sketch-thru-Plan (STP) Engine (v5.1.3+) running on an accessible server
* A Google Maps [API key](https://developers.google.com/maps/documentation/javascript/get-api-key)
* A subscription key for Microsoft's Azure [Speech service](https://docs.microsoft.com/azure/cognitive-services/speech-service/get-started)
* A PC or Mac with a working microphone

## References to the STP SDK

The SDK is included via a `jdelivr` reference on the main html page. Here we show a reference to `@latest`, but as usual, the use of specific version is recommended to prevent breaking changes from affecting existing code

```html
<script src="https://cdn.jsdelivr.net/npm/sketch-thru-plan-sdk@latest/dist/sketch-thru-plan-sdk-bundle-min.js"></script>
```

## Configuration

Enter servers and keys by editing `index.js`. 

* Enter the server address and port where the STP websockets service is running. Make sure the port is *not* blocked by a firewall

```javascript
const webSocketUrl  = "ws://<STP server>:<STP port>";
```

* Replace the Google Maps API placeholders with your own key

```javascript
const googleMapsKey = "<Enter your Google Maps API key here>";
```

* Replace the Azure Speech placeholders with your own 

```javascript
const azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
const azureServiceRegion = "<Enter Azure's subscription region>"; 
const azureLanguage = "en-US";
```

* Optionally pick a different location and zoom level as the default

```javascript
const mapCenter = {lat: 58.967774948, lng: 11.196062412};
const zoomLevel = 13;  
```

**NOTE**: these parameters can be provided as querystring parameters as well/instead, as described next.

## Run the `index.html` sample
1. Load the page on a browser. You may need to serve the page from a proper http location (rather than file:) to avoid browser restrictions. Optional querystring parameters - can be used in addition/instead of default editing as describe in the previous section:

* `mapkey` - Google Maps API key
* `lat`, `lon` - coordinates of the center of the map (decimal degrees)
* `zoom` - initial map zoom level
* `azkey` - MS Cognitive Services Speech API key
* `azregion` - MS Cognitive Services Speech instance region
* `azlang` - MS Cognitive Services Speech language (default is en-US)
* `azendp` - Optional MS Cognitive Services Speech custom language model endpoint
* `stpurl` - STP Websockets URL


1. A connection to the STP server is established and Google Maps is displayed. If an error message is displayed, verify that STP is running on the server at the address and port configured above, and that the port is not being blocked by a firewall
1. Enter symbols by sketching and speaking, for example:
    * Sketch a point (or small line) and speak "Infantry Company", or "Recon Platoon", or "Stryker Brigade"
    * Sketch a line and speak "Phase Line Blue", or "Company Boundary", or "Main Attack Boston"
    * Sketch an area and speak "Objective Bravo" or "Assembly Area"
1. **NOTE**: Authorization for access to the microphone is displayed when speech recognition is activated
    * In Chrome, the authorization popup is shown repeatedly unless the page is served as SSL-enabled `https`. For quick testing, complete the sketching, approve access and speak. Notice as well that Chrome crashes if run from Visual Studio Code in debug mode when the speech recognition is activated
    * Firefox provides a checkbox to avoid the need for repeated authorization, so authorization needs to be provided a single time
1. Successful recognition of the symbol results in generic blue rectangles (for friendly) or red lozenges (enemy) to be displayed, with Tactical Graphics displayed in black
1. To pan and zoom, hold the `Ctrl` key while dragging the mouse


## Code walkthrough

See the [quickstart](../../quickstart) for details on most of the code. Changes introduced in this sample are concentrated on the rendering within [`jmsrenderer.js`](jmsrenderer.js).

The general strategy used is to enhance the basic GeoJSON representation of each symbol (returned by `symbol.asGeoJSON()`) with renderings produced by two renderers

* [milsymbol](https://github.com/spatialillusions/milsymbol) is used to generate SVG icons representing single point symbols (units, equipment, mootw and single point tactical graphics)
* [mil-sym-js](https://github.com/missioncommand/mil-sym-js) is used to generate GeoJSON representations of multipoint tactical graphics


The BasicRenderer used in the quickstarts is replaced in [`index.js'](index.js) by a reference to the JmsRenderer:

```javascript
    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
    // A new symbol has been recognized and added
    stpsdk.onSymbolAdded = (alternates: StpSymbol[], isUndo: boolean) => {
        // Add the best recognition to the map - better if alternates were displayed, could be chosen
        let gj = new JmsRenderer(alternates[0]).asGeoJSON();
        map.addFeature(gj);
    };
    // The properties of a symbol were modified
    stpsdk.onSymbolModified = (poid: string, symbol: StpSymbol, isUndo: boolean) => {
        // Remove current verion
        map.removeFeature(poid);
        // Add the modified symbol
        let gj = new JmsRenderer(symbol).asGeoJSON();
        map.addFeature(gj);
    };
```

The references to these renderers are included in [index.html](index.html). A local `mil-sym-js.js` file contains a (renamed) copy of the code generated by using a `ant concat savm-bc` command in the mil-sym-js project.

```html
    <script src="https://cdn.jsdelivr.net/npm/milsymbol@2.0.0/dist/milsymbol.min.js"></script>
    <script type="application/javascript" src="mil-sym-js.js"></script>
```

If using a different renderer, STP makes the following properties available by default by default (but additional ones can be defined). These need to be mapped to specific parameters of the chosen renderer.

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Symbol type: unit, mootw, equipment, tg, task                                 |
| poid              | STP unique identifier                                                         |
| parentCoa         | Unique id of the COA this symbol belongs to |
| creatorRole       | Role that created the symbol: S2, S3, S4, Eng, FSO |
| interval          | Symbol creation time interval |
| confidence        | Confidence score of the recognition (1.0 is 100%) |
| alt               | Rank of this symbol interpretation amongst the interpretation hypothesis
| sidc.partA        | Part A of the 2525D id |
| sidc.partB        | Part B of the 2525D id |
| sidc.partC        | Part C of the 2525D id |
| sidc.symbolSet    | 2525D Symbol Set |
| sidc.legacy       | 2525C SIDC |
| location          | Location of the symbol (see sub-properties below) |
| shortDescription  | Just the essential distinguishing elements, e.g. designators |
| description       | Name/type of the symbol plus designators, but may omit "friendly", "present" and other assumed decorators |
| fullDescription   | Complete description, including affiliation, status and all decorators |
| affiliation       | pending, unknown, assumedfriend, friend, neutral, suspected, hostile |
| echelon           | none, team, squad, section, platoon, company, battalion, regiment, brigade, division, corps, army, armygroup, region, command |
| parent            | Parent unit designator |
| designator1       | Main symbol designator |
| designator2       | Additional designator, e.g. in a company boundary, indicating the designator of the company to the S or E |
| status            | present, anticipated |
| modifier          | HQ and Task Force modifier: none, dummy, hq, dummy_hq, task_force, dummy_task_force, task_force_hq, dummytask_force_hq |
| strength          | none, reduced, reinforced, reduced_reinforced |
| timeFrom          | Start time, e.g. of a Restricted Operations Zone |
| timeTo            | End time, e.g. of a Restricted Operations Zone |
| altitude          | Altitude parameter, if applicable |
| minAltitude       | Symbol minimal altitude if a range is supported |
| maxAltitude       | Symbol maximal altitude if a range is supported |


### Location properties:

| Property          | Description                                                                   |
| ---------------   | ----------------------------------------------------------------------------- |
| fsTYPE            | Location type: point,line, area |
| width             | Location width, if applicable |
| shpae             | Gesture type, normally point, line or area. Other types include straightline, arrowthin, arrowfat, hook, ubend, ubendthreepoints, vee, opencircle, multipoint see "STP Military Symbol Gestures" documentation for details (available from Hyssos Tech upon request) |
| radius            | Radius of the area containing the symbol, if applicable (zero for point locations) |
| coords            | Array of { lat: latitude, lon: longitude } |
| centroid          | Corrdinates of the location centroid { lat: latitude, lon: longitude } |
| candidatePoids    | Unique Ids of the symbols intersected by "coords". Used for editing operations that use sketches to select objects, for example "move this", "delete this" |
