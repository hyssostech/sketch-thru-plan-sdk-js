/*
 Sketch-thru-plan Planning Canvas sample application
 Copyright Hyssos Tech 2021 
*/

///////////////////////////////////////////////////////////////////////////////////////////////////////
const azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
const azureServiceRegion = "<Enter Azure's subscription region>"; 
const azureLanguage = "en-US"; 
const azureEndPoint =        null; 

const googleMapsKey = "<Enter your Google Maps API key here>";
const defaultMapCenter = {lat: 58.967774948, lon: 11.196062412};
const defaultZoomLevel = 13; 

const defaultWebSocketUrl  = "ws://<STP server>:<STP port>";//"wss://echo.websocket.org";
//////////////////////////////////////////////////////////////////////////////////////////////////////+*/

window.onload = () => start();

//#region Mapping
// Collect freehand drawings over the map, sending strokes to STP
// Adapted from https://stackoverflow.com/a/22808047 

/**
 * Script-wide map object that gets updated as user sketches and stp responds with symbols
 */
let map = null;
let strokeStart = null;
let strokeEnd = null;
let strokePoly= null;

/**
 * Insert the google maps script to the html, linking to our initialization callback
 */
function start() {
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
}

/**
 * Initialize google maps and the STP SDK, setting up the stroke capture events
 * THe standard mode is drawing/sketching - users need to hold the Ctrl key to be able to use the mouse
 * in a conventional (drag) way
 */
async function initMap() {
    // Retrieve (optional) querystring parameters
    const urlParams = new URLSearchParams(window.location.search);
    const latParm = urlParams.get('lat');
    const lonParm = urlParams.get('lon');
    const mapCenter = (latParm && lonParm) ? {lat: parseFloat(latParm), lng: parseFloat(lonParm)} : {lat: 50.676025523733735, lng: 4.406260072708137};
    const zoomParm = urlParams.get('zoom');
    const zoomLevel = zoomParm ? parseInt(zoomParm) : 14;
    const stpParm = urlParams.get('stpurl');
    const webSocketUrl  = stpParm ? stpParm : 'wss://stp.hyssos.com/ws';//"wss://echo.websocket.org";
    const role = urlParams.get('role');

    // Perform STP initialization, bail out if could not connect
    let success = await onInitializing(webSocketUrl);
    if (! success) {
        return;
    }

    // Load map
    map = new google.maps.Map(
        document.getElementById('map'), {
            zoom: zoomLevel, 
            center: mapCenter, 
            gestureHandling: 'cooperative',
            draggable: true,
            draggableCursor: 'crosshair'
        }
    );

    // Set the styling of the geojson data layer, processing features with associated additional svg rendering
    map.data.setStyle((feature) => {
        let rend = feature.getProperty('rendering');
        if (rend) {
            for (let i= 0; i < rend.length; i++) {
                let shape = rend[i].shape.map(item => { return [item.x, item.y]; }).flat();
                let marker = new google.maps.Marker({
                    map: map,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8;base64,' + rend[i].svg,
                        anchor: new google.maps.Point(rend[i].anchor.x, rend[i].anchor.y)
                    },
                    shape: {
                        type: 'poly',
                        coords: shape
                    },
                    position: { lat: rend[i].position.lat, lng: rend[i].position.lon },
                });
                if (rend[i].title) {
                    marker.setTitle(rend[i].title);
                }
                // Advertise selection event
                marker.addListener("click", () => {
                    onSelection(feature.getProperty('symbol'));
                });

                // Store as an asset associated with this feature
                let poid = feature.getProperty('symbol').poid;
                if (!assets.has(poid)) {
                    assets.set(poid, [marker]);
                }
                else {
                    assets.get(poid).push(marker);
                }
            }
            // Hide the standard marker that google wants to display when it sees a point
            return { visible: feature.getGeometry().getType() != 'Point' };
        }
        // No extra decorations rendered - show as-is
        return { visible: true };
    });

    // Advertise feature selection
    map.data.addListener('click', (event) => {
        // Hook up selection event
        onSelection?.call(this, event.feature.getProperty('symbol'));
    });

   // Set events to start sketch capture on mouse down
    map.addListener('mousedown', function(e){
        // Skip if ctrl key is pressed - let user pan on drag 
        let domEvent = e.vb || e.nb || e.domEvent;
        if (domEvent.ctrlKey) {
            return false;
        }
        // Set drawing friendly event handling
        domEvent.preventDefault();
        enableDrawing();

        // Notify STP that a new stroke is starting
        onStrokeStart({lat: e.latLng.lat(), lon: e.latLng.lng()}, getIsoTimestamp());

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
 
        // Notify STP of the new ink stroke
        let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
        let mapBounds = map.getBounds();
        onStrokeCompleted(
            { width: sizePixels.width, height: sizePixels.height }, // pixelBoundsWindow
            { lat: mapBounds.getNorthEast().lat(), lon: mapBounds.getSouthWest().lng()}, //topLeftGeoMap
            { lat: mapBounds.getSouthWest().lat(), lon: mapBounds.getNorthEast().lng()}, //bottomRightGeoMap
            strokeLatLng, //strokePoints
            strokeStart, //timeStrokeStart
            strokeEnd, // timeStrokeEnd
            [] // intersectedPoids
        );
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
 * Restore the standard drag/zoom capabilities
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
 * Add feature to the map
 * @param symbol - Military symbol to add as a feature
 */
function addFeature(symbol) {
    // Get GeoJSON representation and add to map
    let gj = getGeoJSON(symbol);
    if (gj) {
        map.data.addGeoJson(gj);
    }
}

function removeFeature(poid) {
    let feature = map.data.getFeatureById(poid);
    if (feature) {
        // Remove associated assets, if any
        if (assets.has(poid)) {
            let markers = assets.get(poid);
            for (let i= 0; i < markers.length; i++) {
                markers[i].setMap(null);
            }
        }
        map.data.remove(feature);
    }
}

function displayInfo(content, location, handlers) {
    let node = document.createElement('div');
    node.innerHTML = content;

    // Set the symbol info to be displayed at the symbol's centroid
    let centroid = { lat: location.lat, lng: location.lon };
    let infoWindow = new google.maps.InfoWindow({
        content: node,
        position: centroid,
    });

    // Hook event handlers to elements of the info window, if any were provided
    if (infoWindow && handlers && handlers.length) {
        for (let i = 0; i < handlers.length; i++) {
            let instance = node.querySelector(handlers[i].selector);
            if (instance && handlers[i].handler) {
                google.maps.event.addDomListener(instance, 'click', (event) => {
                    if (handlers[i].closeInfo) {
                        infoWindow.close();
                    };
                    handlers[i].handler(event);
                });
            }
        }
    }
    infoWindow.open(map);
}
//#endregion Mapping

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region STP 
let stpsdk = null;
let rendererMP = null;
let assets;

/**
 * Handle the initial loading event, performing STP initialization
 * @param webSocketUrl URL of the STP Websockets endpoint
 * @returns True if initialization was successfull
 */
async function onInitializing(webSocketUrl) {
    // Create an STP connection object - using a websocket connection to STP's native pubsub (OAA)
    const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);

    // Initialize the STP recognizer with the connector definition
    stpsdk = new StpSDK.StpRecognizer(stpconn);

    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
    // A new symbol has been recognized and added
    stpsdk.onSymbolAdded = (alternates, isUndo) => {
        // Add the best recognition to the map - better if alternates were displayed, could be chosen
        addFeature(alternates[0]);
    };
    // The properties of a symbol were modified
    stpsdk.onSymbolModified = (poid, symbol, isUndo) => {
        removeFeature(poid);
        addFeature(symbol);
    };
    // A symbol was removed
    stpsdk.onSymbolDeleted = (poid, isUndo) => {
        removeFeature(poid);
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
        return false;
    }

    // Initialize the mil-sym-js library and supporting rendering structures
    rendererMP = sec.web.renderer.SECWebRenderer;
    if (! rendererMP) {
        throw new Error("Failed to instantiate the Tactical Graphics renderer");
    }
    // Set std to 2525C
    rendererMP.setDefaultSymbologyStandard(1);
    assets = new Map();

    return true;
}

/**
 * Handle the stroke start event, notifying STP
 * @param {LatLon} location Coordinates of the first point
 * @param {string} timestamp Timestamp of the point (ISO-8601)
 */
function onStrokeStart(location, timestamp) {
    // Notify STP that a new stroke is starting
    stpsdk.sendPenDown(location, timestamp);

    // Activate speech recognition (asynchronously)
    recognizeSpeech();
}

/**
 * Handle a stroke completed event, sending the stroke over to STP
 * @param {Size} pixelBoundsWindow Map extent size in pixels
 * @param {LatLon} topLeftGeoMap Top left coordinates of the map extent
 * @param {LatLon} bottomRightGeoMap Bottom right coordinates of the map extent
 * @param {LatLon[]} strokePoints Stroke coordinates
 * @param {string} timeStrokeStart Stroke start timestamp (ISO-8601)
 * @param {string} timeStrokeEnd Stroke end timestamp (ISO-8601)
 * @param {string[]} intersectedPoids 
 */
function onStrokeCompleted(pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids) {
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

/**
 * Handles feature selection, displaying details of the feature
 * @param {StpSymbol} symbol 
 */
function onSelection(symbol)  {
    // Build the content to display
    let contentString = buildInfo(symbol);

    // Get the map to show it, hooking the 'delete' button to a feature removal function
    if (contentString && symbol && symbol.poid && symbol.location && symbol.location.centroid) {
        displayInfo(contentString, symbol.location.centroid, 
            [ 
                { selector: '#delButton', 
                    handler: (event) => {
                        // Advise STP that this symbol was removed - actual removal is done when STP propagates this to 
                        // all clients, including this one
                        stpsdk.deleteSymbol(symbol.poid);
                    },
                    closeInfo: true
                }
            ]
        );
    }
}

/**
 * Recognize speech
 */
async function recognizeSpeech()  {
    try {
        // We create a fresh instance each time to avoid issues with stale connections to the service
        const speechreco = new StpSDK.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint);
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
//#endregion STP
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

////#region Rendering
/**
 * Get a GeoJSON representation of a symbol
 * @param symbol - Military symbol to render 
 * @returns GeoJSON representation
 */
function getGeoJSON(symbol) {
    // Get generic symbol GeoJSON placeholder - this will be decorated with actual rendering below
    let gj = symbol.asGeoJSON();
     // Symbol's centroid is used to anchor infowindows or point symbols themselves
     let centroid = { lat: symbol.location.centroid.lat, lng: symbol.location.centroid.lon };
     // Point symbol rendering using the milsymbol renderer  -  Unit, Mootw, Equipment or TG point symbol
    if (symbol.location.shape == "point") {
        // Load renderer options
        let renderOptions = {};
        if (symbol.parent) {
            renderOptions.higherFormation = symbol.parent;
        }
        if (symbol.fsTYPE === 'equipment' && symbol.affiliation === 'hostile') {
            renderOptions.hostile = 'ENY';
        }
        if (symbol.strength) {
            if (symbol.strength === 'reinforced') {
            renderOptions.reinforcedReduced = '+';
            } else if (symbol.strength === 'reduced') {
                renderOptions.reinforcedReduced = '-';
            } else if (symbol.strength === 'reduced_reinforced') {
                renderOptions.reinforcedReduced = '+-';
            }
        }
        if (symbol.designator1) {
            renderOptions.uniqueDesignation = symbol.designator1;
        }
        if (symbol.altitude) {
            renderOptions.altitudeDepth = symbol.altitude.toString();
        }
        renderOptions.size = 30;
        // Render to svg
        let symbolRenderer = new ms.Symbol(symbol.sidc.legacy, renderOptions);
        let symbolSvg = symbolRenderer.asSVG();
        if (symbolSvg) {
            let anchor = symbolRenderer.getAnchor();
            // Clickable region - needs to be adjusted particularly for hostile symbols, which are rotated
            shape = [
                {x:anchor.x - renderOptions.size / 2, y:anchor.y - renderOptions.size / 2},
                {x:anchor.x + renderOptions.size / 2, y:anchor.y - renderOptions.size / 2},
                {x:anchor.x + renderOptions.size / 2, y:anchor.y + renderOptions.size / 2},
                {x:anchor.x - renderOptions.size / 2, y:anchor.y + renderOptions.size / 2},
            ];
            // Pack the rendering parameters
            let res =  {
                type: 'icon',
                title: symbol.description,
                position: symbol.location.centroid,
                svg: btoa(symbolSvg),
                shape: shape,
                anchor: anchor
            };
            // Save into  GeoJSON so it can be rendered in feature style
            gj.properties.rendering = [ res ];
        }
    }
    else {
        // Convert line, area TG coords to mil-sym-js's - [lon,lat lon,lat ...]
        let tgLatLng = symbol.location.coords.map(item => { return item.lon.toString() + ',' + item.lat.toString(); }).join(' ');
        let format = 2; // formatGeoJSON = 2; formatKML = 0; formatGeoCanvas = 3; formatGeoSVG = 6; 
        let mapBounds = map.getBounds();
        // BBox: "left" (W), "bottom" (S), "right" (E), "top" (N)
        let bbox = mapBounds.getSouthWest().lng().toString() + ',' + mapBounds.getSouthWest().lat().toString() + ',' +
                   mapBounds.getNorthEast().lng().toString() + ',' + mapBounds.getNorthEast().lat().toString();
        var mtg = armyc2.c2sd.renderer.utilities.ModifiersTG;
        modifiers = {};
        if (symbol.designator1) {
            modifiers[mtg.T_UNIQUE_DESIGNATION_1] = symbol.designator1;
        }
        if (symbol.designator2) {
            modifiers[mtg.T_UNIQUE_DESIGNATION_2] = symbol.designator2;
        }
        let scale = 1; // Recalculated internally based on BBounds - sec.web.renderer.
        let json = JSON.parse(rendererMP.RenderSymbol(symbol.poid,symbol.shortDescription,symbol.fullDescription, symbol.sidc.legacy, tgLatLng, "clampToGround",scale, bbox, modifiers,format));
        // RenderSymbol returns a FeatureCollection where labels/decorations are linked to Point features, and the actual tg is usually a MultiLineString feature
        // Here we convert the labels into pre-rendered SVG stored as a 'rendering' property of a single feature that represents the symbol
        if (json.features?.length > 0 ) {
            // Convert labels (point features) into SVG
            let tgGeometry = [];
            let rendering = [];
            for (let i=0; i < json.features.length; i++) {
                if (json.features[i].geometry.type == 'Point') {
                    let position = {lat: json.features[i].geometry.coordinates[1], lon: json.features[i].geometry.coordinates[0]};
                    // Build textual svg for the label and get control points
                    let placedLabel = getSvgLabelAndAnchorPts(json.features[i]);
                    //let shape = [].concat.apply([], placedLabel.shape.map(item => { return [item.x, item.y];}));
                    let shape = placedLabel.shape.map(item => { return [item.x, item.y];}).flat();
                    // Pack the rendering parameters
                    let res =  {
                        type: 'label',
                        position: position,
                        svg: btoa(placedLabel.svg),
                        shape: shape,
                        anchor: placedLabel.anchor,
                        properties: json.features[i].properties
                    };
                    rendering.push(res);
                }
                else {
                    // Save the non-label geometry 
                    tgGeometry.push(json.features[i].geometry);
                }
            }
            // Save into  GeoJSON so it can be rendered in feature style
            gj.properties.rendering = rendering;
            // Replace the simplistic symbol geometry based on the anchor points with the multiline rendering
            if (tgGeometry.length == 1) {
                // Add single geometry directly
                gj.geometry = tgGeometry[0];
            }
            else if (tgGeometry.length > 1) {
                // Wrap into a GeometryCollection
                gj.geometry = {
                    type: 'GeometryCollection',
                    geometries: tgGeometry
                };
            }
            else {
                // TODO: improved logging
                Console.log('No geometry found in rendered geojson');
            }
        }
    }
    return gj;
}

/**
 * Format symbol properties for display
 * @param symbol Symbol properties to display
 */
function buildInfo(symbol){
    if (! symbol || ! symbol.location || ! symbol.location.centroid) {
        return null;
    }
    let contentString =
    '<h3 id="firstHeading" class="firstHeading">' + symbol.fullDescription + '</h3>' +
    '<table>'+
        '<tr>' +
            '<td>2525D PartA</td><td>' + symbol.sidc?.partA + '</td>' +
        '</tr>' +
        '<tr>' +
            '<td>2525D PartB</td><td>' + symbol.sidc?.partB + '</td>' +
        '</tr>' +
        '<tr>' +
            '<td>Symbol Set</td><td>' + symbol.sidc?.symbolSet + '</td>' +
        '</tr>' +
        '<tr>' +
            '<td>2525C SIDC</td><td>' + symbol.sidc?.legacy + '</td>' +
        '</tr>' +
        '<tr>' +
            '<td>Affiliation</td><td>' + symbol.affiliation + '</td>' +
        '</tr>';
    if (symbol.fsTYPE == "unit") {
        contentString +=
        '<tr>' +
            '<td>Echelon</td><td>' + symbol.echelon + '</td>' +
        '</tr>';
    }
    contentString +=
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
        '</tr>';
    if (symbol.fsTYPE == "unit") {
        contentString +=
        '<tr>' +
            '<td>Modifier</td><td>' + symbol.modifier + '</td>' +
        '</tr>' +
        '<tr>' +
            '<td>Strength</td><td>' + symbol.strength + '</td>' +
        '</tr>';
    }
    contentString +=
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
        '<tr>' +
            '<td><button id="delButton">Delete</button></td>' +
        '</tr>' +
    '</table>';
    return contentString;
}

/**
 * Build an SVG representation, anchor point and clickable area points of TG labels
 * @param {GeoJSON.Feature} feature 
 * @returns {svg, anchor, shape}
 */
function getSvgLabelAndAnchorPts(feature) {
    // Build svg based on the provided feature properties
    let labelSvg = 
    '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" >' + //style="border:1px solid black" >' +
        '<text xml:space="preserve" x="0" y="0" ' +
            'dominant-baseline="hanging" text-anchor="start" ' + // Actual alignment done via transformations
            'style="font-size:' + feature.properties.fontSize + ';' + 
                'font-family:' + feature.properties.fontFamily + ';' + 
                'font-style:normal;' +
                'font-weight:' + feature.properties.fontWeight + ';' + 
                'paint-order:stroke;' +
                'fill:' + feature.properties.fontColor + ';' +
                'fill-opacity:1;' +
                'stroke:' + feature.properties.labelOutlineColor + ';' +
                'stroke-width:' + feature.properties.labelOutlineWidth + ';' +
                'stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1;">' + 
                    feature.properties.label + 
        '</text>' +
    '</svg>';
    // Set the size of the svg element and its rotation based on the size of the contained text and desired alignment
    let xAlign = feature.properties.labelAlign;
    let yAlign = xAlign !== "center" ? "bottom" : "top";
    return placeSvgLabel(labelSvg, parseFloat(feature.properties.angle), xAlign, yAlign);
}

/**
 * Set svg width, height, rotation based on size of contained textual label
 * @param {string} labelSvg - svg to patch, as a string
 * @returns Patched svg string, anchor point, shape points - points around the label itself
 */
function placeSvgLabel(labelSvg, angle, xAlign, yAlign) {
    // Create hidden div to house the element being measured
    let tempDiv = document.createElement('div')
    document.body.appendChild(tempDiv);
    // Change visibility _after_ adding to document, otherwise getCMT() will return null
    tempDiv.setAttribute('style', "position:absolute; padding:0; margin:0;visibility:hidden; width:0; height:0")
    // Child svg - set to the parameter contents
    tempDiv.insertAdjacentHTML( 'beforeend', labelSvg )
    let svgEl = tempDiv.querySelector('svg')
    let textEl = svgEl.querySelector('text');
    // Calculate the anchor point given the unrotated text measurements and desired alignments
    let bb = textEl.getBBox()
    let anchor = {x: 0, y:0};
    if (xAlign === 'left') anchor.x = bb.x; 
    else if (xAlign === 'center') { 
        anchor.x = (bb.x + bb.width) / 2.0;
        yAlign = 'center';
    }
    else if (xAlign === 'right')  anchor.x = bb.x + bb.width;
    if (yAlign === 'top')  anchor.y = bb.y; 
    else if (yAlign === 'center')  anchor.y = (bb.y + bb.height) / 2.0 - 2; // TODO: why the magic number?
    else if (yAlign === 'bottom')  anchor.y = bb.y + bb.height;
    // If rotated, apply attribute and adjust anchor point and viewport size
    let transform = '';
    if (angle != 0) {
        // Apply the rotation and get the transformed coordinates that result
        transform = 'rotate(' + angle.toString()  + ') ';
        textEl.setAttribute('transform', transform);
    }
    let rotatedBounds = getTransformedBounds(textEl);
    // Translate enough to get all points inside the viewport (non-negative coords)
    let xTrans = 0;
    let yTrans = 0;
    if (rotatedBounds.minCx < 0) xTrans = rotatedBounds.minCx * -1;
    if (rotatedBounds.minCy < 0) yTrans = rotatedBounds.minCy * -1;
    if (xTrans > 0 || yTrans > 0) {
        // Add translation to the left so that rotation, if present is performed first - order is right to left
        transform = 'translate(' + xTrans.toString() + ',' + yTrans.toString() + ') ' + transform;
        textEl.setAttribute('transform', transform);
    }
    let transBounds = getTransformedBounds(textEl);
    // Set a viewport width and height enough to fit the element even if rotated
    let width = Math.abs(transBounds.maxCx - rotatedBounds.minCx);
    let height = Math.abs(transBounds.maxCy - rotatedBounds.minCy);
    svgEl.setAttribute('width', width.toString());
    svgEl.setAttribute('height', height.toString());
    // Set view box to the same dimensions to keep 1:1 scale wrt the viewport
    svgEl.setAttribute('viewBox', '0 0 ' + width.toString() + ' ' + height.toString());
    // Apply the same transform to the anchor point so it is aligned with the new positions of the text corners
    let m = textEl.getCTM();
    anchor = matrixXY(m,anchor.x,anchor.y);
    // Save the patched svg string
    let svgString = svgEl.outerHTML;
    // Get the points around the shape - potentially rotated rectangle wrapped around the label
    let shapePts = getTransformedPts(textEl);
    // Cleanup
    document.body.removeChild(tempDiv)
    return {svg: svgString, anchor: anchor, shape: shapePts} ;
  }

/**
 * Calculates the bounds of an SVG text element
 * @param {SVGTextElement} el 
 * @returns {minCx:, minCy, maxCx:, maxCy}
 */
function getTransformedBounds(el) {
var pts = getTransformedPts(el);
let bounds = {
    minCx: pts.reduce((min, p) => p.x < min ? p.x : min, pts[0].x),
    minCy: pts.reduce((min, p) => p.y < min ? p.y : min, pts[0].y),
    maxCx: pts.reduce((max, p) => p.x > max ? p.x : max, pts[0].x),
    maxCy: pts.reduce((max, p) => p.y > max ? p.y : max, pts[0].y)
};
return bounds;
} 

/**
 * Get transformed bounding box of an SVG text element
 * @param {SVGTextElement} el 
 * @returns bounding box transformed according to the elements transform
 */
function getTransformedPts( el ) {
var m = el.getCTM();
var bb = el.getBBox();
var tpts = [
    matrixXY(m,bb.x,bb.y),
    matrixXY(m,bb.x+bb.width,bb.y),
    matrixXY(m,bb.x+bb.width,bb.y+bb.height),
    matrixXY(m,bb.x,bb.y+bb.height) ]
// top left, top right, bottom left, bottom right
return tpts;
}

/**
 * Apply transform matrix to x,y point coordinates
 * @param {DOMMatrix} m 
 * @param {number} x 
 * @param {number} y 
 */
function matrixXY(m,x,y) {
    return { x: x * m.a + y * m.c + m.e, y: x * m.b + y * m.d + m.f };
}
//#endregion

//#region Utility functions
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
//#endregion