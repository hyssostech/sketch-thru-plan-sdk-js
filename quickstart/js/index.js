// Collect freehand drawings over the map, sending strokes to STP
// Adapted from https://stackoverflow.com/a/22808047 

/////////////////////////////////////////////////////////////////////////////////////////////////////////
const webSocketUrl  = "ws://<STP server>:<STP port>";//"wss://echo.websocket.org";

const googleMapsKey = "<Enter your Google Maps API key here>";
const googleMapsUrl = "https://maps.googleapis.com/maps/api/js?key=" + googleMapsKey;
const mapCenter = {lat: 58.967774948, lng: 11.196062412};  
const zoomLevel = 13; 

const azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
const azureServiceRegion = "<Enter Azure's subscription region>";  
const azureLanguage = "en-US"; 
////////////////////////////////////////////////////////////////////////////////////////////////////////*/

/**
 * Script-wide map object that gets updated as user sketches and stp responds with symbols
 */
let map = null;
let strokeStart = null;
let strokeEnd = null;
let strokePoly= null;
let stpsdk = null;
/**
 * Insert the google maps script to the html, linking to our initialization callback
 */
(function addMapsScript() {
  if (!document.querySelectorAll('[src="' + googleMapsUrl + '"]').length) { 
    document.body.appendChild(Object.assign(
      document.createElement('script'), {
        type: 'text/javascript',
        src: googleMapsUrl,
        onload: () => initMap()
      }));
  } else {
    initMap();
  }
})();

/**
 * Initialize google maps and the STP SDK, setting up the stroke capture events
 * THe standard mode is drawing/sketching - users need to hold the Ctrl key to be able to use the mouse
 * in a conventional (drag) way
 */
async function initMap() {

    let mapCenter = {lat: 58.967774948, lng: 11.196062412};  //{lat: -25.363, lng: 131.044};

    /////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Create an STP connection object - using a websockets connection to STP
    const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);

    // Initialize the STP recognizer with the connector definition
    stpsdk = new StpSDK.StpRecognizer(stpconn);

    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
    // A new symbol has been recognized and added
    stpsdk.onSymbolAdded = (symbol, isUndo) => {
        displaySymbol(symbol);
    };
    // The collected ink has been processed and resulted in a symbol, or was rejected because it could not be matched to speech
    stpsdk.onInkProcessed = () => {
        // Remove last stroke from the map if one exists
        if (strokePoly)
            strokePoly.setMap(null);
    };
    // Display the top/best speech recognition result
    stpsdk.onSpeechRecognized = (phrases) => {
        let speech = "";
        if (phrases && phrases.length > 0) {
            speech = phrases[0];
        }
        log(speech); 
    }
    // STP event to be communicated to user
    stpsdk.onStpMessage = (msg, level) => {
        log(msg, level, true);
    }

    // Attempt to connect to STP
    try {
        await stpsdk.connect("GoogleMapsSample", 10);
    } catch (error) {
        let msg = "Failed to connect to STP at " + webSocketUrl +". \nSymbols will not be recognized. Please reload to try again";
        log(msg, "Error", true);
    }

    // Create a speech recognizer instance to handle the local transcription - using Azure Speech
    const speechreco = new StpSDK.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion);
    /////////////////////////////////////////////////////////////////////////////////////////////////////////

     // Load map
    map = new google.maps.Map(
        document.getElementById('map'), {
            zoom: 13, 
            center: mapCenter, 
            gestureHandling: 'cooperative',
            draggable: false,
            draggableCursor: 'crosshair'
        });

   // Set events to start sketch capture on mouse down
    map.addListener('mousedown', function(e){
        // Skip if ctrl key is pressed - let user pan on drag 
        let domEvent = e.vb;
        if (domEvent.ctrlKey) {
            return false;
        }
        // Set drawing friendly event handling
        domEvent.preventDefault();
        enableDrawing();

        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Notify STP that a new stroke is starting
        stpsdk.sendPenDown({ lat: e.latLng.lat(), lon: e.latLng.lng()}, getIsoTimestamp());

        // Activate speech recognition (asynchronously), passing in the plugin to use
        recognizeSpeech(speechreco);
        ////////////////////////////////////////////////////////////////////////////////////////////////////////

        // Capture the freehand sketch - pass in the initial coord to support single point clicks
        drawFreeHand(e.latLng)
    });
}

/**
 * Set drawing mode and collect the freehand coordinates until a pen up
 * @param {*} latLng Coordinate of the initial (pendown) point
 */
function drawFreeHand(latLng){
    // Capture start time
    strokeStart = getIsoTimestamp();

    // Clear last stroke, if any
    if (strokePoly)
        strokePoly.setMap(null);

    // Create a new stroke object and load the initial coords
    strokePoly=new google.maps.Polyline({
        map:map,
        clickable:false,
        strokeColor: '#8B0000',
        strokeWeight: 2,
    });
    strokePoly.getPath().push(latLng);
    
    // Add segments as the mouse is moved
    var move=google.maps.event.addListener(map,'mousemove', (e) => {
        strokePoly.getPath().push(e.latLng);
    });
    
    // End the stroke on mouse up
    google.maps.event.addListenerOnce(map,'mouseup', (e) => {
        // Capture end time
        strokeEnd = getIsoTimestamp();

        // Clear the drawing events
        google.maps.event.removeListener(move);
        enableDragZoom();

        // Get the path, adding the initial point twice if there is just a single point (a click)
        // so we have a valid zero-lenght segment that will show as a dot 
        let path=strokePoly.getPath();
        if (path.getLength() == 1)
            path.push(path.getAt(0));

        // Convert to array
        let strokeLatLng = path.getArray().map(item => { let o = {lat: item.lat(), lon: item.lng()}; return o; });
 
        /////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Notify STP of the new ink stroke
        let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
        let mapBounds = map.getBounds();
        stpsdk.sendInk(
            { width: sizePixels.width, height: sizePixels.height }, // pixelBoundsWindow
            { lat: mapBounds.getNorthEast().lat(), lon: mapBounds.getSouthWest().lng()}, //topLeftGeoMap
            { lat: mapBounds.getSouthWest().lat(), lon: mapBounds.getNorthEast().lng()}, //bottomRightGeoMap
            strokeLatLng, //strokePoints
            strokeStart, //timeStrokeStart
            strokeEnd, // timeStrokeEnd
            [] // intersectedPoids
        );
        /////////////////////////////////////////////////////////////////////////////////////////////////////////
    });
}

/**
 * Set map controls so that the mouse can be used to freehand draw
 */
function enableDrawing(){
    map.setOptions({
        draggable: false, 
        zoomControl: false, 
        scrollwheel: false, 
        disableDoubleClickZoom: false
    });
}

/**
 * Restore the standard drag/zomm capabilities
 */
function enableDragZoom(){
    map.setOptions({
        draggable: true, 
        zoomControl: true, 
        scrollwheel: true, 
        disableDoubleClickZoom: true
    });
} 

/**
 * Recognize speech
 * @param speechreco - Speech recognizer plugin
 */
async function recognizeSpeech(speechreco)  {
    try {
        let recoResult = await speechreco.recognize();
        if (recoResult) {
            // Send recognized speech over to STP
            stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
            // Display the best hypothesis
            if (recoResult.results && recoResult.results.length > 0) {
                log(recoResult.results[0].text);
             }
        }
    } catch (e) {
        // Propagate to the user
        let msg = "Failed to process speech: " + e.message;
        log(msg), "Error", true;
    }
}

/**
 * Displays symbol on the map, using a blue rectangle if friendly, red lozenge if hostile, black tactical graphics
 * @param symbol - Military symbol to render 
 */
function displaySymbol(symbol) {
    // Build symbol description
    const contentString =
        '<div id="content">' +
        '<div id="siteNotice">' +
        "</div>" +
        '<h3 id="firstHeading" class="firstHeading">' + symbol.fullDescription + '</h3>' +
        '<table>' +
            '<tr>' +
                '<td>2525D PartA</td><td>' + symbol.sidc.partA + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>2525D PartB</td><td>' + symbol.sidc.partB + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Symbol Set</td><td>' + symbol.sidc.symbolSet + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>2525C SIDC</td><td>' + symbol.sidc.legacy + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Affiliation</td><td>' + symbol.affiliation + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Echelon</td><td>' + symbol.echelon + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Parent Unit</td><td>' + symbol.parent + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Designator 1</td><td>' + symbol.designator1 + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Designator 2</td><td>' + symbol.designator2 + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Status</td><td>' + symbol.status + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Modifier</td><td>' + symbol.modifier + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Strength</td><td>' + symbol.strength + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Time From</td><td>' + symbol.timeFrom + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Time To</td><td>' + symbol.timeTo + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Altitude</td><td>' + symbol.altitude + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Min Altitude</td><td>' + symbol.minAltitude + '</td>' +
            '</tr>' +
            '<tr>' +
                '<td>Max Altitude</td><td>' + symbol.maxAltitude + '</td>' +
            '</tr>' +
        '</table>' +
        '<div id="bodyContent">' +
        "</div>" +
        "</div>";
    // Set the symbol info to be displayed at teh symbol's centroid
    let centroid = { lat: symbol.location.centroid.lat, lng: symbol.location.centroid.lon };
    let infoWindow = new google.maps.InfoWindow({
        content: contentString,
        position: centroid,
        });
    // Tactical graphics may be lines or areas
    if (symbol.fsTYPE === "tg") {
        // Convert TG coords to google map's
        let tgLatLng = symbol.location.coords.map(item => { let o = {lat: item.lat, lng: item.lon}; return o; });
        let options = {
            path: tgLatLng,
            geodesic: true,
            strokeColor: "black",
            strokeOpacity: 1.0,
            strokeWeight: 3,
        };
        // Closed polygonal area 
        if (symbol.location.fsTYPE === "area") {
            const tgPoly = new google.maps.Polygon(options);
            tgPoly.setMap(map);
            tgPoly.addListener("click", () => {
                infoWindow.open(map);
            });
        }
        else {
            // Line TG
            // Remove the "barb"/width point that is part of the 2525 drawing rules, but messes up gmaps rendering
            if (symbol.location.shape == "arrowfat")
                tgLatLng.length--;
            const tgPoly = new google.maps.Polyline(options);
            tgPoly.setMap(map);
            // Display tg info on click
            tgPoly.addListener("click", () => {
                infoWindow.open(map);
            });
        }
    }
    else {
        // Unit, Mootw, Equipment symbol - point location
        // Draw icon
        const icon = {
            fillOpacity: 0.5,
            scale: 1,
            strokeWeight: 1,
        };
        if (symbol.affiliation === "friend") {
        // Generic blue rectangle for friendly forces - 0,0 is at the center of the icon to match the symbol's location
        icon.path = "M -21,-15 -21,15 21,15 21,-15 z";
                icon.fillColor = "#1077aa";
                icon.strokeColor = "#1077aa";
        }
        else if (symbol.affiliation === "hostile") {
        // Generic red lozenge for friendly forces - 0,0 is at the center of the icon to match the symbol's location
        icon .path = "M -18,0 0,18 18,0 0,-18 z";
            icon.fillColor = "red";
            icon.strokeColor = "red";
        }
        const marker = new google.maps.Marker({
            position: centroid,
            map,
            title: symbol.description,
            icon: icon,
        });
        // Display symbol info on click
        marker.addListener("click", () => {
            infoWindow.open(map, marker);
        });
    }
}

/**
 * Current time in ISO 8601 format
 * @return ISO-8601 string
 */
function getIsoTimestamp() {
    let timestamp = new Date();
    return timestamp.toISOString();
}

/**
 * 
 * @param msg - Message to display
 * @param level - Level of criticality of the message
 * @param showAlert - True causes an alert to popup
 */
function log(msg, level, showAlert) {
    if (showAlert) {
        alert(msg);
    }
    // Add to the log display area
    let control = document.getElementById("messages")
    control.innerHTML=msg;
    control.style.color =  level === "Error" ? "red" : "black";
}
