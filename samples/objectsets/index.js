///////////////////////////////////////////////////////////////////////////////////////////////////////
let azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
let azureServiceRegion = "<Enter Azure's subscription region>"; 
let azureLanguage = "en-US"; 
let azureEndPoint = null;

let googleMapsKey = "<Enter your Google Maps API key here>";
let mapCenter = { lat: 58.967774948, lon: 11.196062412 };
let zoomLevel = 13; 

let webSocketUrl  = "ws://<STP server>:<STP port>";//"wss://<STP server/proxy_path";
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

    const appName = "SdkObjectSetSample";

    // Create an STP connection object - using a websocket connection to STP's native pub/sub system
    const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
    stpconn.user = userName;

    // Initialize the STP recognizer with the connector definition
    stpsdk = new StpSDK.StpRecognizer(stpconn);

    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
    // The objects a load applies are announced one by one as ordinary events - count them for the report
    stpsdk.onSymbolAdded = (alternates, isUndo) => {
        announced('SymbolAdded');
        // A load or import re-sends objects this map may already show - replace rather than duplicate
        map.removeFeature(alternates[0]?.poid);
        let gj = new JmsRenderer(alternates[0], map.getBounds()).asGeoJSON();
        map.addFeature(gj);
    };
    stpsdk.onSymbolModified = (poid, symbol, isUndo) => {
        announced('SymbolModified');
        map.removeFeature(poid);
        let gj = new JmsRenderer(symbol, map.getBounds()).asGeoJSON();
        map.addFeature(gj);
    };
    stpsdk.onSymbolDeleted = (poid, isUndo) => {
        announced('SymbolDeleted');
        map.removeFeature(poid);
    };
    stpsdk.onTaskAdded = () => announced('TaskAdded');
    stpsdk.onTaskDeleted = () => announced('TaskDeleted');
    stpsdk.onTaskOrgAdded = () => announced('TaskOrgAdded');
    stpsdk.onTaskOrgUnitAdded = () => announced('TaskOrgUnitAdded');
    stpsdk.onTaskOrgRelationshipAdded = () => announced('TaskOrgRelationshipAdded');

    //#region Object-set actions
    const kindSelect = document.getElementById('kind');
    const poidBox = document.getElementById('poid');

    // Get: read the content as an array of typed objects. Each object carries its content in PrologTerm (its STP
    // text); send the array back as it is
    document.getElementById('get').onclick = async () => {
        try {
            const kind = kindSelect.value;
            if (kind === 'scenario') {
                objects = await stpsdk.getScenarioObjectSet();
            } else {
                objects = await stpsdk.getTaskOrgObjectSet(poidBox.value.trim());
            }
            objectsKind = kind;
            showObjects();
            log("Read " + (objects?.length ?? 0) + " objects");
        } catch (error) {
            log(error, 'Error');
        }
    };
    // Load replaces the whole scenario, Import merges into it, Sync applies the differences.
    // A task org object set can only be imported
    document.getElementById('load').onclick = () => runLoad('load');
    document.getElementById('import').onclick = () => runLoad('import');
    document.getElementById('sync').onclick = () => runLoad('sync');

    // Keep the objects in a file and read them back
    document.getElementById('download').onclick = () => {
        const blob = new Blob([JSON.stringify(objects ?? [], null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = objectsKind + '-objectset.json';
        a.click();
        URL.revokeObjectURL(a.href);
    };
    document.getElementById('file').onchange = async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;
            objects = JSON.parse(await file.text());
            showObjects();
            log("Read " + objects.length + " objects from " + file.name + " - pick the kind they are before importing");
        } catch (error) {
            log(error, 'Error');
        }
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
        // While a load runs, the engine also announces its report as an StpMessage - that is all a client
        // receives when its own timeout fires first. Keep them for the report
        if (loading) loadMessages.push('[' + level + '] ' + msg);
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

//#region Object set loading and the load report
let objects = undefined;
let objectsKind = 'scenario';
let loading = false;
let counts = {};
let loadMessages = [];

async function afterJoin() {
}

/**
 * Count what the engine announced while a load runs
 */
function announced(eventName) {
    if (loading) counts[eventName] = (counts[eventName] ?? 0) + 1;
}

/**
 * Show how many objects of each type are held
 */
function showObjects() {
    const byType = {};
    for (const o of objects ?? []) {
        const t = o?.fsTYPE ?? '(not an object)';
        byType[t] = (byType[t] ?? 0) + 1;
    }
    document.getElementById('held').textContent = (objects?.length ?? 0) + ' objects (' + objectsKind + '): ' +
        Object.entries(byType).map(([t, n]) => t + ' ' + n).join(', ');
}

/**
 * Send the held objects back to STP and report the outcome
 * @param op - 'load', 'import' or 'sync'
 */
async function runLoad(op) {
    if (!objects) {
        log("Get the objects first (or open a file)", "Error");
        return;
    }
    const kind = document.getElementById('kind').value;
    if (kind !== 'scenario' && op !== 'import') {
        log("A " + kind + " object set can only be imported", "Error");
        return;
    }
    // The load timeout, in seconds. It bounds both the engine's load (the engine stops when it runs out and
    // answers with a report of what it did) and this client's wait for the answer
    const timeout = parseInt(document.getElementById('timeout').value) || 90;

    // Optionally break one object, to see the engine refuse the load and name it
    let toSend = objects;
    if (document.getElementById('breakOne').checked && objects.length > 0) {
        toSend = objects.slice();
        const last = { ...toSend[toSend.length - 1] };
        delete last.PrologTerm;
        toSend[toSend.length - 1] = last;
    }

    loading = true;
    counts = {};
    loadMessages = [];
    const started = Date.now();
    let outcome;
    try {
        if (kind === 'taskorg') {
            const poid = await stpsdk.importTaskOrgFromObjectSet(toSend, timeout);
            outcome = { ok: true, text: "Task org imported: " + poid };
        } else if (op === 'load') {
            await stpsdk.loadNewScenarioFromObjectSet(toSend, timeout);
            outcome = { ok: true, text: "Scenario replaced" };
        } else if (op === 'import') {
            await stpsdk.importPlanDataFromObjectSet(toSend, timeout);
            outcome = { ok: true, text: "Objects merged into the scenario" };
        } else {
            await stpsdk.syncScenarioSessionFromObjectSet(toSend, timeout);
            outcome = { ok: true, text: "Session synced" };
        }
    } catch (error) {
        // A refused or stopped load rejects with the engine's report: the object it stopped at and why, the objects
        // applied before it, any rejected or skipped, the one in flight when the timeout cut it off, and those
        // not applied or not sent. The objects applied before the stop STAY applied
        outcome = { ok: false, text: error?.message ?? String(error) };
    }
    // Give the events and StpMessages that trail the answer a moment to arrive
    await new Promise((r) => setTimeout(r, 500));
    loading = false;
    showReport(op, toSend.length, timeout, Date.now() - started, outcome);
}

/**
 * Show the load report: what was sent, what the engine announced, and its answer
 */
function showReport(op, sent, timeout, ms, outcome) {
    const lines = [];
    lines.push(op + ' of ' + sent + ' objects, timeout ' + timeout + ' s, answered in ' + ms + ' ms: ' +
        (outcome.ok ? 'OK' : 'FAILED'));
    const announcedList = Object.entries(counts).map(([e, n]) => e + ' ' + n).join(', ');
    lines.push('Announced while loading: ' + (announcedList || 'nothing'));
    if (outcome.ok) {
        lines.push(outcome.text);
    } else if (outcome.text === 'Operation timed out') {
        // This client's own timer fired first: the answer, if the engine sends one, is no longer waited for.
        // The engine announces the same report as an StpMessage
        lines.push('This client stopped waiting after ' + timeout + ' s. The engine\'s report, if it sent one:');
        lines.push(...(loadMessages.length ? loadMessages : ['(none received - an engine before STP-1095 names nothing)']));
    } else {
        // Each sentence of the report on its own line: "Applied before it (7): ...", "Not applied (1): ..."
        lines.push(...outcome.text.split(/(?<=\.)\s+(?=[A-Z][^.()]*\(\d+\):)/));
    }
    document.getElementById('report').textContent = lines.join('\n');
    logEvent(lines[0]);
}
//#endregion
