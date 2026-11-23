///////////////////////////////////////////////////////////////////////////////////////////////////////
let azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
let azureServiceRegion = "<Enter Azure's subscription region>"; 
let azureLanguage = "en-US"; 
let azureEndPoint = null;

let googleMapsKey = "<Enter your Google Maps API key here>";
let mapCenter = { lat: 58.967774948, lon: 11.196062412 };
let zoomLevel = 13; 

let webSocketUrl  = "wss://<STP server/proxy_path>";// or "ws://<STP server>:<STP port>" for a local server without TLS
// The person using this client. STP 5.12 records it as the author of this client's changes in the task history,
// and a client that registers without one cannot add task comments
let userName = "Sample user";
//////////////////////////////////////////////////////////////////////////////////////////////////////+*/

window.onload = () => start();

window.onerror = (msg, url, line, col, error) => {
    try {
        var extra = !col ? '' : '\ncolumn: ' + col;
        // Ignore empty messages
        if (!msg && line === 0) {
            log('Unexpected Error: ' + msg + ' url: ' + url + ' line: ' + line + extra, 'Error', true);
            // Suppress additional error alerts (in some browsers)
            return true;
        }
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
    // 'user' - name of the person using this client (task history author)
    //
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
    if (stpParm) webSocketUrl = stpParm;
    const userParm = urlParams.get('user');
    if (userParm) userName = userParm;

    const appName = "SdkBatchSample";

    // Create an STP connection object - using a websocket connection to STP's native pub/sub system
    const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
    stpconn.user = userName;

    // Initialize the STP recognizer with the connector definition
    stpsdk = new StpSDK.StpRecognizer(stpconn);

    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified

    //#region Batches
    // A batch begins: one client's bulk operation - a load, an import, a sync, a join's replay,
    // a multi-delete ... Every object event it produces carries its batchId.
    // Do not wait for BatchStarted before handling objects: an engine that predates batches sends none,
    // and its object events carry no batchId
    stpsdk.onBatchStarted = (batch) => {
        batches.set(batch.batchId, { started: batch, events: [] });
        logEvent("BatchStarted " + batch.batchId + " kind=" + batch.kind + " expected=" + batch.expected +
            " isOwn=" + batch.isOwn + " origin=" + batch.origin);
        renderBatches();
    };
    // The batch ended, after its last object event. Work held for the batch (a pane refresh, a selection,
    // a map fit) runs now, once, instead of once per object
    stpsdk.onBatchEnded = (batch) => {
        const b = batches.get(batch.batchId) ?? { started: batch, events: [] };
        b.ended = batch;
        batches.set(batch.batchId, b);
        logEvent("BatchEnded " + batch.batchId + " status=" + batch.status + " informs=" + batch.informs +
            " (seen here: " + b.events.length + ")");
        renderBatches();
    };
    //#endregion

    //#region Object events - each carries the batchId of the batch it arrived in, or undefined outside one
    stpsdk.onSymbolAdded = (alternates, isUndo, batchId) => {
        objectEvent("SymbolAdded", alternates[0]?.poid, batchId);
        // A load or import re-sends objects this map may already show - replace rather than duplicate
        map.removeFeature(alternates[0]?.poid);
        let gj = new JmsRenderer(alternates[0], map.getBounds()).asGeoJSON();
        map.addFeature(gj);
    };
    stpsdk.onSymbolModified = (poid, symbol, isUndo, batchId) => {
        objectEvent("SymbolModified", poid, batchId);
        map.removeFeature(poid);
        let gj = new JmsRenderer(symbol, map.getBounds()).asGeoJSON();
        map.addFeature(gj);
    };
    stpsdk.onSymbolDeleted = (poid, isUndo, batchId) => {
        objectEvent("SymbolDeleted", poid, batchId);
        map.removeFeature(poid);
    };
    stpsdk.onTaskAdded = (poid, alternates, taskPoids, isUndo, batchId) => objectEvent("TaskAdded", poid, batchId);
    stpsdk.onTaskModified = (poid, alternates, taskPoids, isUndo, batchId) => objectEvent("TaskModified", poid, batchId);
    stpsdk.onTaskDeleted = (poid, isUndo, batchId) => objectEvent("TaskDeleted", poid, batchId);
    stpsdk.onTaskOrgAdded = (taskOrg, isUndo, batchId) => objectEvent("TaskOrgAdded", taskOrg?.poid, batchId);
    stpsdk.onTaskOrgModified = (poid, taskOrg, isUndo, batchId) => objectEvent("TaskOrgModified", poid, batchId);
    stpsdk.onTaskOrgDeleted = (poid, isUndo, batchId) => objectEvent("TaskOrgDeleted", poid, batchId);
    stpsdk.onTaskOrgUnitAdded = (toUnit, isUndo, batchId) => objectEvent("TaskOrgUnitAdded", toUnit?.poid, batchId);
    stpsdk.onTaskOrgUnitModified = (poid, toUnit, isUndo, batchId) => objectEvent("TaskOrgUnitModified", poid, batchId);
    stpsdk.onTaskOrgUnitDeleted = (poid, isUndo, batchId) => objectEvent("TaskOrgUnitDeleted", poid, batchId);
    stpsdk.onTaskOrgRelationshipAdded = (rel, isUndo, batchId) => objectEvent("TaskOrgRelationshipAdded", rel?.poid, batchId);
    stpsdk.onTaskOrgRelationshipModified = (poid, rel, isUndo, batchId) => objectEvent("TaskOrgRelationshipModified", poid, batchId);
    stpsdk.onTaskOrgRelationshipDeleted = (poid, isUndo, batchId) => objectEvent("TaskOrgRelationshipDeleted", poid, batchId);
    stpsdk.onTaskEventAdded = (poid, entry, batchId) => objectEvent("TaskEventAdded", poid, batchId);
    stpsdk.onTaskEventModified = (poid, entry, batchId) => objectEvent("TaskEventModified", poid, batchId);
    //#endregion

    //#region Bulk operations that produce batches
    // Keep the scenario text so that Load/Import/Sync have something to send back
    let content = '';
    document.getElementById('save').onclick = async () => {
        try {
            content = await stpsdk.getScenarioContent();
            log("Scenario content kept (" + content.length + " characters) - Load, Import or Sync it to see a batch");
        } catch (error) {
            log(error, 'Error');
        }
    };
    // Replace the scenario: the engine resets it and sends every object again, as one batch (kind 'load')
    document.getElementById('load').onclick = async () => {
        if (!content) { log("Save first", "Error"); return; }
        try {
            await stpsdk.loadNewScenario(content, 90);
            log("Loaded");
        } catch (error) {
            log(error, 'Error');
        }
    };
    // Merge the content into the scenario: one batch (kind 'import')
    document.getElementById('import').onclick = async () => {
        if (!content) { log("Save first", "Error"); return; }
        try {
            await stpsdk.importPlanData(content, 90);
            log("Imported");
        } catch (error) {
            log(error, 'Error');
        }
    };
    // Bring the session in line with the content - only the differences arrive, as one batch
    document.getElementById('sync').onclick = async () => {
        if (!content) { log("Save first", "Error"); return; }
        try {
            await stpsdk.syncScenarioSession(content, 90);
            log("Synced");
        } catch (error) {
            log(error, 'Error');
        }
    };
    // Join replays the scenario's objects to this client as one batch with origin 'replay'
    document.getElementById('join').onclick = async () => {
        try {
            await stpsdk.joinScenarioSession();
            log("Joined");
        } catch (error) {
            log(error, 'Error');
        }
    };
    document.getElementById('clear').onclick = () => {
        batches.clear();
        singles.length = 0;
        document.getElementById('log').textContent = '';
        renderBatches();
    };
    //#endregion

    // The collected ink has been processed and resulted in a symbol, or was rejected because it could not be matched to speech
    stpsdk.onInkProcessed = () => {
        // Remove last stroke from the map if one exists
        map.clearInk();
    };
    // Display the top/best speech recognition result
    stpsdk.onSpeechRecognized = (phrases) => {
        if (phrases && phrases.length > 0) {
            log(phrases[0]);
        }
    }
    // STP event to be communicated to user - refusals of fire-and-forget calls arrive here
    stpsdk.onStpMessage = (msg, level) => {
        if (level === 'Debug') return;
        log(msg, level);
        logEvent('StpMessage [' + level + '] ' + msg);
    }

    // Connection to STP and app launch
    const buttonConnect = document.getElementById('connect');
    buttonConnect.onclick = async () => {
        try {
            // Retrieve the session - if empty, defaults are applied by STP - 
            const sessionBox = document.getElementById('sessionId');
            let session = sessionBox.value;
            // Connect and display the assigned session id on the UI
            sessionBox.value = await stpsdk.connect(appName, 30, machineId, session);
            // Load map and join/create the scenario
            await runApp(appName);
        } catch (error) {
            let msg = "Failed to connect to STP at " + webSocketUrl + ". \nPlease reload to try again";
            log(msg, "Error", true);
            // Nothing else we can do
            return;
        }
    };

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
                // Stop further recognition now that we have candidates
                speechreco.stopRecognizing();
                // Send recognized speech over to STP
                stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
                log(recoResult.results.map((item) => item.text).join(' | '));
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
    map = new LeafletMap(null, 'map', mapCenter, zoomLevel);

    // Notify STP of the start of a stroke and activate speech recognition
    map.onStrokeStart = (location, timestamp) => {
        stpsdk.sendPenDown(location, timestamp);
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
}

async function runApp(appName) {
    // Load the map
    map.load();

    // Join the scenario if there is an active one already - joining replays its objects as events
    if (! await stpsdk.hasActiveScenario()) {
        log("STP session has no active scenario - creating new");
        await stpsdk.createNewScenario(appName);
        log("New scenario created");
    }
    else {
        await stpsdk.joinScenarioSession();
        log("Joined the session's active scenario");
    }
    await afterJoin();
}
//#endregion

//#region Utility functions
/**
 * Show the latest message in the status line
 * @param msg - Message to display
 * @param level - Level of criticality of the message
 * @param showAlert - True causes an alert to popup
 */
function log(msg, level='Info', showAlert = false) {
    if (showAlert) {
        alert(msg);
    }
    let control = document.getElementById("messages")
    if (! control) {
        throw new Error("Html page must contain a 'messages' div");
    }
    control.textContent = (msg instanceof Error) ? msg.message : msg;
    control.style.color =  level === "Error" ? "red" : "black";
}

/**
 * Add a line to the event log in the side panel, newest first
 * @param line - Text to add
 */
function logEvent(line) {
    const control = document.getElementById("log");
    if (!control) return;
    const time = new Date().toLocaleTimeString();
    control.textContent = time + " " + line + "\n" + control.textContent;
}

/**
 * Escape text before placing it in HTML
 */
function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
//#endregion

//#region Batch bookkeeping and display
// Batches by batchId, with the object events that arrived in each, and the events that arrived outside any
const batches = new Map();
const singles = [];

async function afterJoin() {
}

/**
 * Record an object event under its batch - or as a single edit when it carries no batchId
 * (a lone sketch or speech edit, or an engine that predates batches)
 */
function objectEvent(name, poid, batchId) {
    if (batchId) {
        // An event can arrive for a batch whose BatchStarted this client did not see (it connected mid-batch)
        const b = batches.get(batchId) ?? { started: { batchId, kind: '?' }, events: [] };
        b.events.push(name + " " + (poid ?? ''));
        batches.set(batchId, b);
    } else {
        singles.push(name + " " + (poid ?? ''));
        logEvent("single edit: " + name + " " + (poid ?? ''));
    }
    renderBatches();
}

function renderBatches() {
    const body = document.getElementById('batchRows');
    body.innerHTML = '';
    for (const [batchId, b] of batches) {
        const row = document.createElement('tr');
        const status = b.ended ? b.ended.status + ' (' + b.ended.informs + ' informs)' : 'open';
        row.innerHTML =
            '<td><b>' + esc(b.started.kind) + '</b> ' + (b.started.isOwn ? 'own' : 'other client') +
                ' ' + esc(b.started.origin ?? '') + '<br><small>' + esc(batchId) + '</small></td>' +
            '<td>' + b.events.length + (b.started.expected >= 0 ? ' / ' + b.started.expected : '') + '</td>' +
            '<td>' + esc(status) + '</td>';
        row.title = b.events.join('\n');
        body.appendChild(row);
    }
    document.getElementById('singles').textContent = singles.length;
}
//#endregion
