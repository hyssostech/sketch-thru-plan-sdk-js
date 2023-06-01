///////////////////////////////////////////////////////////////////////////////////////////////////////
azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
azureServiceRegion = "<Enter Azure's subscription region>"; 
azureLanguage = "en-US"; 
azureEndPoint = null;

googleMapsKey = "<Enter your Google Maps API key here>";
mapCenter = { lat: 58.967774948, lon: 11.196062412 };
zoomLevel = 13; 

webSocketUrl  = "ws://<STP server>:<STP port>";//"wss://<STP server/proxy_path";
//////////////////////////////////////////////////////////////////////////////////////////////////////+*/

window.onload = () => start();

window.onerror = (msg, url, line, col, error) => {
    try {
        var extra = !col ? '' : '\ncolumn: ' + col;
        // You can view the information in an alert to see things working like this:
        log('Unexpected Error: ' + msg + ' url: ' + url + ' line: ' + line + extra, 'Error', true);
        // Suppress additional error alerts (in some browsers)
        return true;
    } catch (error) {
        // Ignore failures during the attempt to report
    }
}

//#region STP functions
let stpsdk;
let map;

async function start(){
    // Retrieve (optional) querystring parameters
    // 'stpurl' - STP Websockets URL
    //
    // 'mapkey' - Google Maps API key
    // 'lat', 'lon' - coordinates of the center of the map (decimal degrees)
    // 'zoom' - initial map zoom level
    //
    // 'azkey' - MS Cognitive Services Speech API key
    // 'azregion' - MS Cognitive Services Speech instance region
    // 'azlang' - MS Cognitive Services Speech language (default is en-US)
    // 'azendp' - Optional MS Cognitive Services Speech custom language model endpoint
    //
    // 'inkonly' - Speech is collected by another component running on the same box
    // 'machineid' - Identifier used in the ink messages Used to match the identifier of a matched speech recognizer the ink should be combined with (both need to have the same Id to be paired)
    const urlParams = new URLSearchParams(window.location.search);
    const mapKey = urlParams.get('mapkey');
    if (mapKey) googleMapsKey = mapKey;
    const latParm = urlParams.get('lat');
    const lonParm = urlParams.get('lon');
    if (latParm && lonParm) mapCenter = { lat: parseFloat(latParm), lon: parseFloat(lonParm) };
    const zoomParm = urlParams.get('zoom');
    if (zoomParm) zoomLevel = parseInt(zoomParm);

    const azKey = urlParams.get('azkey');
    if (azKey) azureSubscriptionKey = azKey;
    const azRegion = urlParams.get('azregion');
    if (azRegion) azureServiceRegion = azRegion;
    const azLang = urlParams.get('azlang');
    if (azLang) azureLanguage = azLang;
    const azEndp = urlParams.get('azendp');
    if (azEndp) azureEndPoint = azEndp;

    const inkOnly = urlParams.get('inkonly');
    const machineId = urlParams.get('machineid');
    
    const stpParm = urlParams.get('stpurl');
    if (stpParm) webSocketUrl =  stpParm;

    // Create an STP connection object - using a websocket connection to STP's native pub/sub system
    const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);

    // Initialize the STP recognizer with the connector definition
    stpsdk = new StpSDK.StpRecognizer(stpconn);

    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
    // A new symbol has been recognized and added
    stpsdk.onSymbolAdded = (alternates, isUndo) => {
        // Add the best recognition to the map - better if alternates were displayed, could be chosen
        let gj = new JmsRenderer(alternates[0], map.getBounds()).asGeoJSON();
        map.addFeature(gj);
    };
    // The properties of a symbol were modified
    stpsdk.onSymbolModified = (poid, symbol, isUndo) => {
        // Remove current verion
        map.removeFeature(poid);
        // Add the modified symbol
        let gj = new JmsRenderer(symbol, map.getBounds()).asGeoJSON();
        map.addFeature(gj);
    };
    // A symbol was removed
    stpsdk.onSymbolDeleted = (poid, isUndo) => {
        map.removeFeature(poid);
    };
 
    // A new Task Org Unit has been recognized and added
    stpsdk.onTaskOrgAdded = (taskOrg, isUndo) => {
        try {
            // Display some properties
            log("Task Org added: " + taskOrg.name, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a Task Org Unit were modified
    stpsdk.onTaskOrgModified = (poid, taskOrg, isUndo) => {
        try {
            // Display some properties
            log("Task  Org modified: " + poid + " " + taskOrg.name, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A Task Org Unit was removed
    stpsdk.onTaskOrgDeleted = (poid, isUndo) => {
        try {
            // Display some properties
            log("Task  Org deleted: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };

    // A new Task Org Unit has been recognized and added
    stpsdk.onTaskOrgUnitAdded = (toUnit, isUndo) => {
        try {
            // Display some properties
            log("Task Org Unit added: " + toUnit.fullDescription, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a Task Org Unit were modified
    stpsdk.onTaskOrgUnitModified = (poid, toUnit, isUndo) => {
        try {
            // Display some properties
            log("Task  Org Unit modified: " + poid + " " + toUnit.fullDescription, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A Task Org Unit was removed
    stpsdk.onTaskOrgUnitDeleted = (poid, isUndo) => {
        try {
            // Display some properties
            log("Task  Org Unit deleted: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };

    // A new Task Org Relationship has been recognized and added
    stpsdk.onTaskOrgRelationshipAdded = (toRelationship, isUndo) => {
        try {
            // Display some properties
            log("Task Org Relationship added: " + toRelationship.poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a Task Org Relationship were modified
    stpsdk.onTaskOrgRelationshipModified = (poid, toRelationship, isUndo) => {
        try {
            // Display some properties
            log("Task Org Relationship modified: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A Task Org Relationship was removed
    stpsdk.onTaskOrgRelationshipDeleted = (poid, isUndo) => {
        try {
            // Display some properties
            log("Task Org Relationship deleted: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };

     // A new task has been recognized and added
     stpsdk.onTaskAdded = (poid, alternates, taskPoids, isUndo) => {
        try {
            // Display some properties
            log("Task added: " + alternates[0].description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // The properties of a task were modified
    stpsdk.onTaskModified = (poid, alternates, taskPoids, isUndo) => {
        try {
            // Display some properties
            log("Task modified: " + poid + " " + alternates[0].description, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };
    // A task was removed
    stpsdk.onTaskDeleted = (poid, isUndo) => {
        try {
            // Display some properties
            log("Task removed: " + poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };

    // The collected ink has been processed and resulted in a symbol, or was rejected because it could not be matched to speech
    stpsdk.onInkProcessed = () => {
        // Remove last stroke from the map if one exists
        map.clearInk();
    };
    // Display the top/best speech recognition result
    stpsdk.onSpeechRecognized = (phrases) => {
        // Display just the best reco - the one that is actually selected by STP may not be this one
        let speech = "";
        if (phrases && phrases.length > 0) {
            if (inkOnly != null && /[a-z]/.test(phrases[0].charAt(0))) {
                // Display all alternates produced by the external recognizer
                speech = phrases.slice(0,5).join(' | ');
            }
            else {
                // Display the best hypothesis used to define the current symbol
                speech = phrases[0];
            }
        }
        log(speech); 
    }
    // STP event to be communicated to user
    stpsdk.onStpMessage = (msg, level) => {
        log(msg, level, true);
    }

    // UI element handlers
    // Scenario actions
    const buttonNew = document.getElementById('new');
    buttonNew.onclick = async () => {
        try {
            // TODO: display some sort of progress indicator/wait cursor
            resetApp();
            await stpsdk.createNewScenario("SdkScenarioSample");
            log("New scenario created");
        } catch (error) {
            log(error, 'Error');
        }
    };
    const buttonJoin = document.getElementById('join');
    buttonJoin.onclick = async () => {
        try {
            // TODO: display some sort of progress indicator/wait cursor
            if (await stpsdk.hasActiveScenario()) {
                resetApp();
                await stpsdk.joinScenarioSession();
                log("Joined scenario");
            }
            else {
                log("No Active Scenario");
            }
        } catch (error) {
            log(error, 'Error');
        }
    };
    // Save and load content
    // TODO: save/retrieve content to/from file
    let content = '';
    const buttonSave = document.getElementById('save');
    buttonSave.onclick = async () => {
        try {
            // TODO: display some sort of progress indicator/wait cursor
            if (await stpsdk.hasActiveScenario()) {
                content = await stpsdk.getScenarioContent();
                // TODO: save content to persistent storage
                log("Saved scenario");
            }
            else {
                log("No Active Scenario");
            }
        } catch (error) {
            log(error, 'Error');
        }
    };
    const buttonLoad = document.getElementById('load');
    buttonLoad.onclick = async () => {
        try {
            if (content !== '') {
                // TODO: retrieve content from persistent storage instead of 'content' variable
                // TODO: display some sort of progress indicator/wait cursor
                initApp();
                await stpsdk.loadNewScenario(content, 90);
                log("Loaded scenario");
            }
            else {
                log("No scenario data to load - Save first");
            }
        } catch (error) {
            log(error, 'Error');
        }
    };

    // TO/ORBAT actions
    // Load a friendly Task Org
    let toFriend = undefined;
    const buttonFriend = document.getElementById('friend');
    buttonFriend.onclick = async () => {
        try {
            if (toFriend === undefined) {
                // TODO: retrieve content from persistent storage instead of 'content' variable
                // TODO: display some sort of progress indicator/wait cursor
                let content = `object_set([
                    [fsTYPE: task_org, name: '3-3 short', affiliation: friend, poid: idR47DS5VCGL9ZE, date: '2023-05-22T13:40:00Z'],
                    [fsTYPE: task_org, name: '3-3 short', affiliation: friend, poid: idR47DS5VCGL9ZE, date: '2023-05-22T13:40:00Z'],
                    [fsTYPE: task_org_unit, name: 'A/2-69', designator1: 'A', unit_parent: '2-69', sidc: 'SFGPUCIZ---E---', parent_poid: poid(idR47DS5VCGL9ZE), affiliation: friend, echelon: company, poid: 'uuid7e99345a-f15a-4939-b963-0b83b1ec40f0'],
                    [fsTYPE: task_org_unit, name: 'PINEAPPLES | [ROYAL] PINEAPPLES', designator1: '1', unit_parent: 'A/2-69', sidc: 'SFGPUCIZ---D---', parent_poid: poid(idR47DS5VCGL9ZE), affiliation: friend, echelon: platoon, poid: 'uuid5336c5d5-9182-4846-bdd8-5c517869c274'],
                    [fsTYPE: task_org_relationship, poid: idPNPMCKGE2TPLF, affiliation: friend, parent: poid(uuid7e99345a-f15a-4939-b963-0b83b1ec40f0), relationship: organic, child: poid(uuid5336c5d5-9182-4846-bdd8-5c517869c274), parent_poid: poid(idR47DS5VCGL9ZE)],
                ])`;
                toFriend = await stpsdk.importTaskOrgContent(content);
            }
            await stpsdk.setDefaultTaskOrg(toFriend);
            //buttonGetTO.style.backgroundColor = 'lightblue';
            log("Friendly TO " + toFriend + " set as default");
        } catch (error) {
            log(error, 'Error');
        }
    };

    // Load a hostile Task Org
    let toHostile = undefined;
    const buttonHostile = document.getElementById('hostile');
    buttonHostile.onclick = async () => {
        try {
            if (toHostile === undefined) {
                // TODO: retrieve content from persistent storage instead of 'content' variable
                // TODO: display some sort of progress indicator/wait cursor
                let hostile = `object_set([
                    [fsTYPE: task_org, name: 'Hostile 1-1', affiliation: hostile, poid: idR47DS5VCGL8AB, date: '2023-05-22T13:40:00Z'],
                    [fsTYPE: task_org_unit, name: 'B/1-1', designator1: 'B', unit_parent: '1-1', sidc: 'SHGPUCIZ---E---', parent_poid: poid(idR47DS5VCGL8AB), affiliation: hostile, echelon: company, poid: uuid7e99345a-f15a-4939-b963-0b83b1ec51a2],
                    [fsTYPE: task_org_unit, name: '1/B/1-1', designator1: '1', unit_parent: 'B/1-1', sidc: 'SHGPUCIZ---D---', parent_poid: poid(idR47DS5VCGL8AB), affiliation: hostile, echelon: platoon, poid: uuid5336c5d5-9182-4846-bdd8-5c517869d342],
                    [fsTYPE: task_org_relationship, poid: idPNPMCKGE5TRTF, affiliation: friend, parent: poid(uuid7e99345a-f15a-4939-b963-0b83b1ec51a2), relationship: organic, child: poid(uuid5336c5d5-9182-4846-bdd8-5c517869d342), parent_poid: poid(idR47DS5VCGL8AB)],
                    ])`;
                toHostile = await stpsdk.importTaskOrgContent(hostile);
            }
            await stpsdk.setDefaultTaskOrg(toHostile);
            //buttonGetTO.style.backgroundColor = 'red';
            log("Hostile TO " + toHostile + " set as default");
        } catch (error) {
            log(error, 'Error');
        }
    };

    // Persist active TO
    let toPoid = undefined;
    const buttonGetTO = document.getElementById('getto');
    buttonGetTO.onclick = async () => {
        // Get TO content back, ready to persist
        try {
            if (toPoid) {
                let toContent = await stpsdk.getTaskOrgContent(toPoid);
                log("Retrieved content of latest TO (id " + toPoid + ") ready to save");
            }
            else {
                log("Nothing to retrieve. Load a TO first");
            }
        } catch (error) {
            log(error, 'Error');
        }
    };


    // A new TO became active
    stpsdk.onTaskOrgSwitched = (taskOrg) => {
        try {
            // Set the current TO id
            toPoid = taskOrg.poid;
            // Display new task org on the UI
            const toName = document.getElementById('toName');
            toName.innerText = taskOrg?.name ?? 'none';
            if (taskOrg?.affiliation == 'friend') {
                toName.style.color = 'blue';
            }
            else if (taskOrg?.affiliation == 'hostile') {
                toName.style.color = 'red';
            }
            else {
                toName.style.color = 'gray';
            }
            log("Task Org switched to: " + taskOrg.poid, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };

    // Reset/Initialize local parameters
    resetApp = () => {
        toFriend = undefined;
        toHostile = undefined;
        toPoid = undefined;
        toName.innerText = 'none';
        toName.style.color = 'gray';
    };

    // Attempt to connect to STP
    try {
            // TODO: display some sort of progress indicator/wait cursor
        await stpsdk.connect("SdkTaskOrgSample", 10, machineId);
        // Create new scenario or join ongoing one
        if (await stpsdk.hasActiveScenario()) {
            if (confirm("Select Ok to join existing scenario or Cancel to create a new one")) {
                await stpsdk.joinScenarioSession();
                log("Joined scenario");
            }
            else {
                await stpsdk.createNewScenario("SdkTaskOrgSample");
                log("New scenario created");
            }
        }
    } catch (error) {
        let msg = "Failed to connect to STP at " + webSocketUrl + ". \nSymbols will not be recognized. Please reload to try again";
        log(msg, "Error", true);
        // Nothing else we can do
        return;
    }

    // Setup the networked MS recognizer unless disabled via configuration
    let speechreco;
    if (inkOnly != null) {
        // Likely using a local recognizer SxS
        speechreco = null;
    }
    else {
        // Create speech recognizer and subscribe to recognition events
        speechreco = new StpAS.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint, null, azureLanguage);
        speechreco.onRecognized = (recoResult) => {
            if (recoResult && recoResult.results && recoResult.results.length > 0) {
                // Stop further recognition now that we have cnadidates
                speechreco.stopRecognizing();
                // Send recognized speech over to STP
                stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
                // Display the hypotheses to the user
                let concat = recoResult.results.map((item) => item.text).join(' | ');
                log(concat);
            }
        }
        // Display the recognition as it evolves
        speechreco.onRecognizing = (snippet) => {
            log(snippet);
        }
        // Error recognizing
        speechreco.onError = (e) => {
            log("Failed to process speech: " + e.message);
        }
    }

    // Create map instance and subscribe to sketching events
    map = new GoogleMap(googleMapsKey, 'map', mapCenter, zoomLevel);

    // Notify STP of the start of a stroke and activate speech recognition
    map.onStrokeStart = (location, timestamp) => {
        // Notify STP that a new stroke is starting
        stpsdk.sendPenDown(location, timestamp);

        // Activate speech recognition (asynchronously)
        speechreco?.startRecognizing();
    }

    // Notify STP of a full stroke
    map.onStrokeCompleted = (
        pixelBoundsWindow,
        topLeftGeoMap,
        bottomRightGeoMap,
        strokePoints,
        timeStrokeStart,
        timeStrokeEnd,
        intersectedPoids
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
        // Stop speech recognition after 5 seconds
        speechreco?.stopRecognizing(5000);
    }

    // Handle feature selection
    map.onSelection = (symbol) => {
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
                        stpsdk.deleteSymbol(symbol.poid);
                      },
                      closeInfo: true
                    }
                ]
            );
        }
    }

    // Load the map
    map.load();
}

/**
 * Format symbol properties for display
 * @param symbol Symbol properties to display
 */
function buildInfo(symbol) {
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
        '</tr>' +
        '<tr>' +
            '<td>Branch</td><td>' + symbol.branch + '</td>' +
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

//#region Utility functions
/**
 * 
 * @param msg - Message to display
 * @param level - Level of criticality of the message
 * @param showAlert - True causes an alert to popup
 */
function log(msg, level='Info', showAlert = false) {
    if (showAlert) {
        alert(msg);
    }
    // Add to the log display area
    let control = document.getElementById("messages")
    if (! control) {
        throw new Error("Html page must contain a 'messages' div");
    }
    control.innerHTML=msg;
    control.style.color =  level === "Error" ? "red" : "black";
}
//#endregion
