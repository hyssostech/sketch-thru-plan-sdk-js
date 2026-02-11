# Quickstart Overview

Language-specific Google Maps samples are included:

* [js](js) folder - Vanilla javascript introductory example
* [ts](ts) folder - Typescript example


Both versions have similar code structures. We overview the code here using the typescript version as a reference. The javascript version is similar, except of course for the type annotations and other details that can be examined in the respective README docs linked to above.

These examples have bare bones, placeholder rendering capabilities, meant to be replaced by production quality rendering in a real application. The [samples](../samples) include in these resources demonstrate the use of actual military symbol rendering.


# Adding military symbols to Google Maps via Speech and Sketch

The quickstarts demonstrate the how sketches (and optionally speech) collected by a typescript browser app can be sent for processing by Sketch-thru-Plan (STP) for interpretation. If successfully interpreted, the combined/fused speech and sketch are turned into military symbols by STP, and sent back to the app for rendering.

The connection to STP and the speech recognizer that is used are configurable via plugins. The quickstarts use the following plugins:

* Websockets connector that communicates with STP's  Publish Subscribe system
* Speech recognition based on Microsoft Cognitive Services Speech to Text service


## Prerequisites
* Sketch-thru-Plan (STP) Engine (v5.8.7+) running on an accessible server
* A Google Maps [API key](https://developers.google.com/maps/documentation/javascript/get-api-key)
* A subscription key for Microsoft's Azure [Speech service](https://docs.microsoft.com/azure/cognitive-services/speech-service/get-started)
* A PC or Mac with a working microphone
* Means to serve a page over https

### Accessing the SDK functionality

Install the npm packeage:

```
npm install --save sketch-thru-plan-sdk
```

Or embed it directly as a script using jsdelivr. As always, it is recommended that a specific version be used rather than @latest to prevent breaking changes from affecting existing code

```javascript
<!-- Include _after_ the external services such as the Microsoft Cognitive Services Speech -->
<script src="https://cdn.jsdelivr.net/npm/sketch-thru-plan-sdk@latest/dist/sketch-thru-plan-sdk-bundle-min.js"></script>
```

## Configuration

The SDK and samples rely on three categories of configuration. These describe the nature of what must be provided, independent of any specific parameter names:

1. Mapping service configuration: the mapping provider API credential, the initial map center (latitude/longitude in decimal degrees), and the initial zoom level.
2. Speech recognition configuration: the speech service subscription credential, the service region where your subscription resides, the recognition language/locale, and an optional endpoint if using a custom speech model.
3. STP engine connection configuration: the WebSockets endpoint for the STP engine (hostname and port, or a reverse-proxy URL).

### Provide via Querystring

You can pass all configuration via querystring parameters. This is convenient for quick testing and hosted samples.

Parameters:

* Keys corresponding to the categories above:
    * Mapping: `mapkey`, `lat`, `lon`, `zoom`
    * Speech: `azkey`, `azregion`, `azlang`, `azendp`
    * STP connection: `stpurl`

Example:

```
https://your-host/quickstart/ts/dist/index.html?mapkey=YOUR_GOOGLE_KEY&stpurl=ws://localhost:9599&lat=58.96777&lon=11.19606&zoom=13&azkey=YOUR_AZURE_KEY&azregion=eastus&azlang=en-US
```

### Provide via Code

Alternatively, define the parameters directly in code by editing 
[ts/src/index.ts](ts/src/index.ts) or [js/index.js](js/index.js):

```javascript
// STP engine connection: WebSockets endpoint (hostname:port or reverse-proxy URL)
// Ensure the port is reachable and not blocked by a firewall
const webSocketUrl = "ws://<STP server>:<STP port>"; // e.g., ws://localhost:9599

// Mapping service: Google Maps API key and script URL
const googleMapsKey = "<YOUR_GOOGLE_MAPS_API_KEY>";
const googleMapsUrl = "https://maps.googleapis.com/maps/api/js?key=" + googleMapsKey;

// Speech recognition: Azure Cognitive Services Speech config
const azureSubscriptionKey = "<YOUR_AZURE_SPEECH_SUBSCRIPTION_KEY>"; 
const azureServiceRegion = "<YOUR_AZURE_SPEECH_REGION>"; // e.g., eastus, westeurope
const azureLanguage = "en-US"; // locale, e.g., en-US, sv-SE

// Map initialization: default center and zoom
const mapCenter = { lat: 58.967774948, lng: 11.196062412 };
const zoomLevel = 13;
```

## Run the  sample

* Load the `quicktstart/ts/dist/index.html` or `quickstart/js/index.html` on a browser. You may need to serve the page from a proper https location (rather than file:) to avoid browser microphone access restrictions

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

Other plugins can be developed to implement different communication mechanisms, for example plain REST calls, or based on some event queue mechanism used by the backend infrastructure into which STP may have been embedded. The websockets plugin is posted [here](../plugins/connectors/websockets-plugin)

```javascript
// Create an STP connection object - using a websocket connection to STP's pub/sub system
const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
```

**STP recognizer initialization** - communication with STP is achieved via recognizer object that takes the connector and optional speech plugins as parameters 

```javascript
// Initialize the STP recognizer with the connector configuration defined above
stpsdk = StpSDK.StpRecognizer(stpconn);
```

**Event subscription** - Before connecting to STP, it is important to subscribe to the handlers of interest. This information is used by the SDK to build the corresponding subscription parameters that tell STP which events/messages to send to this client app.

STP triggers events asynchronously as user actions are interpreted as military symbols (and other types of entities, not covered here). This quickstart subscribes to:

* onSymbolAdded - invoked whenever a new symbol is created as a result of successful combination of user speech and sketch
* onSymbolModified - invoked whenever the properties of a symbol are modified
* onSymbolDeleted - invoked whenever the a symbol is deleted/removed
* onInkProcessed - invoked when strokes have been processed by STP. This event is useful for removing ink that either resulted in a successful symbol interpretation, or was dropped from consideration, to keep the interface clean
* onSpeechRecognized - provides feedback on the speech to text interpretation. This even is optional, but provides meaningful feedback to users. 
* onStpMessage - is triggered by STP when a message needs to be brought to the user's attention, for example notices of disconnection, communication failures.

```javascript
// Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
// A new symbol has been recognized and added
stpsdk.onSymbolAdded = (alternates: StpSymbol[], isUndo: boolean) => {
    // Add the best recognition to the map - better if alternates were displayed, could be chosen
    let gj = new BasicRenderer(alternates[0]).asGeoJSON();
    map.addFeature(gj);
};
// The properties of a symbol were modified
stpsdk.onSymbolModified = (poid: string, symbol: StpSymbol, isUndo: boolean) => {
    // Remove current verion
    map.removeFeature(poid);
    // Add the modified symbol
    let gj = new BasicRenderer(symbol).asGeoJSON();
    map.addFeature(gj);
};
// A symbol was removed
stpsdk.onSymbolDeleted = (poid: string, isUndo: boolean) => {
    map.removeFeature(poid);
};
// The collected ink has been processed and resulted in a symbol, or was rejected because it could not be matched to speech
stpsdk.onInkProcessed = () => {
    // Remove last stroke from the map if one exists
    map.clearInk();
};
// Display the top/best speech recognition result
stpsdk.onSpeechRecognized = (phrases: string[]) => {
    // Display just the best reco - the one that is actually selected by STP may not be this one
    let speech = "";
    if (phrases && phrases.length > 0) {
        speech = phrases[0];
    }
    log(speech); 
}
// STP event to be communicated to user
stpsdk.onStpMessage = (msg: string, level: StpMessageLevel) => {
    log(msg, level, true);
}
```

**Connection to STP** - Once the SDK is configured, the connection itself can be attempted. Connection failures are surfaced as exceptions (generated by javascript Promise rejections)

```javascript
// Attempt to connect to STP
try {
    await stpsdk.connect("GoogleMapsSample", 10);
} catch (error) {
    let msg = "Failed to connect to STP at " + webSocketUrl +". \nSymbols will not be recognized. Please reload to try again";
    log(msg, StpMessageLevel.Error, true);
    // Nothing else we can do
    return;
}
```

### Providing sketch events to STP

STP requires two events to be raised when the user sketches: 

1. A pen down event that signals the start of a sketched gesture
2. The completed stroke that follows

For convenience, it is also useful to be able to detect when STP-placed features are selected, so that additional information or actions can be performed as a response.

While code in applications embedding the STP SDK will likely use different approaches, in this sample, map presentation and sketching are encapsulated in a class that handles the mapping logic, and invokes handlers when the events above take place. 
These are described in more detail in the [mapping README](../plugins/maps/gogglemaps/README.md).

**Map initialization** - Each mapping system will require its own particular initialization. In this sample, the constructor takes the API key, the  Id of the HTML div where map is presented, and the initial center and zoom.

```javascript
    // Create map instance and subscribe to sketching events
    map = new GoogleMap(googleMapsKey, 'map', mapCenter, zoomLevel);
```

**Sending pen down on stroke start** - The pen down latitude and longitude location and the time (UTC in ISO-8601 format) are provided as parameters. Notice that the sample also starts speech recognition at the time a stroke is started (see additional details further down)

```javascript
    // Notify STP of the start of a stroke and activate speech recognition
    map.onStrokeStart = (location: LatLon, timestamp: string) => {
        // Notify STP that a new stroke is starting
        stpsdk.sendPenDown(location, timestamp);

        // Activate speech recognition (asynchronously)
        recognizeSpeech();
    }
```
**Sending the stroke** - Once the stroke is completed (on pen up), the full stroke is sent to STP for processing. Parameters provide:

```javascript
    // Notify STP of a full stroke
    map.onStrokeCompleted = (
        pixelBoundsWindow:Size,
        topLeftGeoMap: LatLon,
        bottomRightGeoMap:LatLon,
        strokePoints: LatLon[],
        timeStrokeStart: string,
        timeStrokeEnd: string,
        intersectedPoids:string[]
    ) => {
        // Notify STP of the new ink stroke
        stpsdk.sendInk(
            pixelBoundsWindow,
            topLeftGeoMap,
            bottomRightGeoMap,
            strokePoints,
            timeStrokeStart,
            timeStrokeEnd,
            intersectedPoids
        );
    }
```

NOTE: `intersectedPoids` sends to STP a list of the unique identifiers of the symbols that a sketched gesture crosses/overlaps.
This information is important for operations that use gestures to identify affected objects. 
These operations are of two main kinds:
* Property setting operations, where users may sketch a tick mark over a symbol and change a symbol's properties by speaking tnew values, such as 'designator Alpha', or 'reinforced reduced'
* Edit operations, such as select, delete, or move, where a sketched mark identifies what should be selected, deleted or moved.

In this series of samples, this information is _not_ being captured. 
The call to `onStrokeCompleted` in `googlemaps.ts/js` passes an empty array.

```javascript
    if (this.onStrokeCompleted) {
        this.onStrokeCompleted(
            new Size(sizePixels.width, sizePixels.height),
            new LatLon(mapBounds.getNorthEast().lat(), mapBounds.getSouthWest().lng()),
            new LatLon(mapBounds.getSouthWest().lat(), mapBounds.getNorthEast().lng()),
            strokeLatLng,
            this.strokeStart,
            this.strokeEnd,
            [] // intersectedPoids
        );
    }
```

**Handling map symbol clicks** - In this sample, selection causes the properties of the symbol to be displayed (in an infowindow/popup) that includes a `delete` button. 

```javascript
    // Handle feature selection
    map.onSelection = (symbol: StpSymbol) => {
        // Build the content to display
        let contentString = buildInfo(symbol);

        // Get the map to show it, hooking the 'delete' button to a feature removal function
        if (contentString && symbol && symbol.poid && symbol.location && symbol.location.centroid) {
            map.displayInfo(contentString, symbol.location.centroid, 
                [ 
                    { selector: '#delButton', 
                      handler: (event) => {
                        // Advise STP that this symbol was removed - actual removal is done when STP propagates this to 
                        // all clients, including this one
                        stpsdk.deleteSymbol(symbol.poid!);
                      },
                      closeInfo: true
                    }
                ]
            );
        }
    }
```
After the handlers have been configured, the map is loaded.

```javascript
    // Load the map
    map.load();
```


**Speech** - Speech can be collected by the browser by invoking a speech service

This quickstart uses a Microsoft Cognitive Services Speech to Text plugin, but the same principles apply if using other services. The microphone is activated every time a new stroke is started (on pen down). This is a simple but effective strategy. See the [speech plugin](../plugins/speech/azurespeech-plugin) for details and additional discussion of alternative speech collection strategies

As previously seen, recognition in the sample is initiated by the `onStrokeStart` handler. The call is *not* waited, and proceeds asynchronously while the sketch is completed.

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
        let recoResult = await speechreco.recognizeOnce();
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

### Symbol rendering

The quickstarts use a bare bones placeholder renderer which display single point symbols as geometric shapes indicating affiliation:

* Friendly - blue rectangles
* Hostile - red lozenges
* Neutral - green squares
* Unknown - yellow circles

Multipoint Tactical Graphics are displayed by simple lines represented by GeoJSON geometries.

The code can be found in the [`basicrenderer.ts`](ts/src/basicrenderer.ts) or [`basicrenderer.js](js/basicrenderer.js).

For additional, actual rendering examples, see the [samples](../samples). 



