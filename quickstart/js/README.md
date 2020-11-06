# Quickstart: Add military symbols to Google Maps via Speech and Sketch

This quickstart demonstrates the how sketches (and optionally speech) collected by a vanilla javascript browser app can be sent for processing by Sketch-thru-Plan (STP) for interpretation. If successfully interpreted, the combined/fused speech and sketch are turned into military symbols by STP, and sent back to the app for rendering.

The connection to STP and the speech recognizer that is used are configurable via plugins. For this quickstart, the following plugins are used:

* Websockets connector that communicates with STP's Publish Subscribe system
* Speech recognition based on Microsoft Cognitive Services Speech to Text service

The speech recognition plugin is optional, and can be replaced for example by a separate component running on the client machine. Details are outside the scope of this guide.

## Prerequisites
* Sketch-thru-Plan (STP) Engine (v5.1.0+) running on an accessible server
* A Google Maps [API key](https://developers.google.com/maps/documentation/javascript/get-api-key)
* Optional: a subscription key for Microsoft's Azure [Speech service](https://docs.microsoft.com/azure/cognitive-services/speech-service/get-started)
* A PC or Mac with a working microphone

## References to the STP SDK

The SDK is included via a `jdelivr` reference on the main html page. Here we show a reference to `@latest`, but as usual, the use of specific version is recommended to prevent breaking changes from affecting existing code

```html
<script src="https://cdn.jsdelivr.net/npm/sketch-thru-plan-sdk@latest/dist/sketch-thru-plan-sdk-bundle-min.js"></script>
```

## Configuration

Enter servers and keys by editing `index.js`:

* Enter the server address and port where the STP websockets service is running. Make sure the port is *not* blocked by a firewall

```javascript
const webSocketUrl  = "ws://<STP server>:<STP port>";
```

* Replace the Google Maps API placeholders with your own keys

```javascript
const googleMapsKey = "<Enter your Google Maps API key here>";
const googleMapsUrl = "https://maps.googleapis.com/maps/api/js?key=" + googleMapsKey;
```

* If using browser-based speech, replace the Azure Speech placeholders with your own 

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

## Run the `index.html` sample
* Load the page on a browser. You may need to serve the page from a proper http location (rather than file:) to avoid browser restrictions
* A connection to the STP server is established and Google Maps is displayed. If an error message is displayed, verify that STP is running on the server at the address and port configured above, and that the port is not being blocked by a firewall
* Enter symbols by sketching and speaking, for example:
    * Sketch a point (or small line) and speak "Infantry Company", or "Recon Platoon", or "Stryker Brigade"
    * Sketch a line and speak "Phase Line Blue", or "Company Boundary", or "Main Attack Boston"
    * Sketch an area and speak "Objective Bravo" or "Assembly Area"
* **NOTE**: Authorization for access to the microphone is displayed when speech recognition is activated
    * In Chrome, the authorization popup is shown repeatedly unless the page is served as SSL-enabled `https`. For quick testing, complete the sketching, approve access and speak. Notice as well that Chrome crashes if run from Visual Studio Code in debug mode when the speech recognition is activated
    * Firefox provides a checkbox to avoid the need for repeated authorization, so authorization needs to be provided a single time
* Successful recognition of the symbol results in generic blue rectangles (for friendly) or red lozenges (enemy) to be displayed, with Tactical Graphics displayed in black
* To pan and zoom, hold the `Ctrl` key while dragging the mouse


## Brief code walkthrough

### Initialization 

**Connector Plugin** - The first step it to create a connection object that will provide the basic communication services to STP. In this quickstart app, we employ a Websockets connector that communicates with STP's native OAA Publish Subscribe services. 

Other plugins can be developed to implement different communication mechanisms, for example plain REST calls, or based on some event queue mechanism used by the backend infrastructure into which STP may have been embedded. The OAA plugin is provided as a [sample](../samples/typescript/connector-plugin)

```javascript
// Create an STP connection object - using a websocket connection to STP's  pub/sub system 
const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
```

**STP recognizer initialization** - communication with STP is achieved via recognizer object that takes the connector and optional speech plugins as parameters 

```javascript
// Initialize the STP recognizer with the connector configuration defined above
stpsdk = new StpSDK.StpRecognizer(stpconn);
```

**Event subscription** - Before connecting to STP, it is important to subscribe to the handlers of interest. This information is used by the SDK to build the corresponding subscription parameters that tell STP which events/messages to send to this client app.

STP triggers events asynchronously as user actions are interpreted as military symbols (and other types of entities, not covered here). This quickstart subscribes to:

* onSymbolAdded - invoked whenever a new symbol is created as a result of successful combination of user speech and sketch
* onInkProcessed - invoked when strokes have been processed by STP. This event is useful for removing ink that either resulted in a successful symbol interpretation, or was dropped from consideration, to keep the interface clean
* onSpeechRecognized - provides feedback on the speech to text interpretation. This even is optional, but provides meaningful feedback to users. 
* onStpMessage - is triggered by STP when a message needs to be brought to the user's attention, for example notices of disconnection, communication failures.

```javascript
// Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
// A new symbol has been recognized and added - render it to the map
stpsdk.onSymbolAdded = (symbol, isUndo) => {
    displaySymbol(symbol);
};
// The collected ink has been processed and resulted in a symbol, or was rejected because it could not be matched to speech - clear the ink from the map
stpsdk.onInkProcessed = () => {
    // Remove last stroke from the map if one exists
    if (strokePoly)
        strokePoly.setMap(null);
};
// Display the top/best speech recognition result as user feedback
stpsdk.onSpeechRecognized = (phrases) => {
    let speech = "";
    if (phrases && phrases.length > 0) {
        speech = phrases[0];
    }
    log(speech); 
}
// STP event to be communicated to user
stpsdk.onStpMessage = (msg, level) => {
    alert("STP message: " + msg);
    log(msg, level);
}
```

**Connection to STP** - Once the SDK is configured, the connection itself can be attempted. Connection failures are surfaced as exceptions (generated by javascript Promise rejections)

```javascript
// Attempt to connect to STP, naming this service "GoogleMapsSample" and using a default timeout
try {
    await stpsdk.connect("GoogleMapsSample", 0);
} catch (error) {
    let msg = "Failed to connect to STP at " + webSocketUrl +". \nSymbols will not be recognized. Please reload to try again";
    alert(msg);
    log(msg, "Error");
}
```

## Providing sketch and speech events to STP

**Sending pen down** - STP requires two events to be raised when the user sketches: a pen down event that signals the start of a sketched gesture, followed by the complete stroke. The pen down latitude and longitude location and the time (UTC in ISO-8601 format) are provided as parameters.

```javascript
// Notify STP that a new stroke is starting
stpsdk.sendPenDown({ lat: e.latLng.lat(), lon: e.latLng.lng()}, getIsoTimestamp());
```

**Sending the stroke** - Once the stroke is completed (on pen up), the full stroke is sent to STP for processing. Parameters provide:

* The current settings of the viewport in pixels and latitude/longitude coordinates
* The stroke points in latitude/longitude decimal degrees coordinates (`{lat: 58.95657852665, lon:11.175978030896}`)
* Start and end times (UTC in ISO-8601 format)
* Array of unique ids of symbols that the stroke overlaps - used for editing operations - can be empty for this sample 

```javascript
// Notify STP of the new ink stroke
let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
let mapBounds = map.getBounds();
stpsdk.sendInk(
    { width: sizePixels.width, height: sizePixels.height }, // pixelBoundsWindow
    { 
        lat: mapBounds.getNorthEast().lat(), 
        lon: mapBounds.getSouthWest().lng()
    }, //topLeftGeoMap
    { 
        lat: mapBounds.getSouthWest().lat(), 
        lon: mapBounds.getNorthEast().lng()
    }, //bottomRightGeoMap
    strokeLatLng, //strokePoints
    strokeStart, //timeStrokeStart
    strokeEnd, // timeStrokeEnd
    [] // intersectedPoids
);
```

**Speech** - Speech can be collected by the browser by invoking a speech service

This quickstart uses a Microsoft Cognitive Services Speech to Text plugin that is bundled with the STP SDK for convenience. The microphone is activated every time a new stroke is started (on pen down). This is a simple but effective strategy. See the [speech sample](../samples/typescript/azurespeech-plugin) for details and additional discussion of alternative speech collection strategies

The `mousedown` event listener starts recognition. The call is *not* waited, and proceeds asynchronously while the sketch is completed:

```javascript
// Activate speech recognition (asynchronously)
recognizeSpeech();
```
When successfully recognized, speech is sent to STP via the `sendSpeechRecognition` SDK call:

```javascript
async function recognizeSpeech()  {
    try {
        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        // We create a fresh instance each time to avoid issues with stale connections to the service
        const speechreco = new StpSDK.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion);
        let recoResult = await speechreco.recognize();
        if (recoResult) {
            // Send recognized speech over to STP
            stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
            // Display the best hypothesis
            if (recoResult.results && recoResult.results.length > 0) {
                log(recoResult.results[0].text);
             }
        }
        /////////////////////////////////////////////////////////////////////////////////////////////////////////
    } catch (e) {
        // Propagate to the user
        let msg = "Failed to process speech: " + e.message;
        log(msg), "Error", true;
    }
}
```

## Symbol rendering

This quickstart makes use of simple Google Maps capabilities to display symbols as rectangles, lozenges and line markers, associated with InfoWindows showing their properties when the markers are selected with a mouse. 

STP symbols provide detailed information in their properties that can be used to drive a military symbol renderer such as [milsymbol](https://github.com/spatialillusions/milsymbol), or [mil-sym-js](https://github.com/missioncommand/mil-sym-js) 

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
| shpae             | Gesture type, normally point, line or area. Other types include straightline, arrowthin, arrowfat, hook, ubend, ubendthreepoints, vee, opencircle, multipoint see "STP Military Symbol Gestures" documentation for details  (available from Hyssos Tech upon request)|
| radius            | Radius of the area containing the symbol, if applicable (zero for point locations) |
| coords            | Array of { lat: latitude, lon: longitude } |
| centroid          | Corrdinates of the location centroid { lat: latitude, lon: longitude } |
| candidatePoids    | Unique Ids of the symbols intersected by "coords". Used for editing operations that use sketches to select objects, for example "move this", "delete this" |
