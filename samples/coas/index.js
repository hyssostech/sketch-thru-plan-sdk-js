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

    const appName = "SdkCoaSample";

    // Create an STP connection object - using a websocket connection to STP's native pub/sub system
    const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
    stpconn.user = userName;

    // Initialize the STP recognizer with the connector definition
    stpsdk = new StpSDK.StpRecognizer(stpconn);

    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified

    // Symbols are drawn into the current COA - show them on the map
    stpsdk.onSymbolAdded = (alternates, isUndo) => {
        let gj = new JmsRenderer(alternates[0], map.getBounds()).asGeoJSON();
        map.addFeature(gj);
    };
    stpsdk.onSymbolModified = (poid, symbol, isUndo) => {
        map.removeFeature(poid);
        let gj = new JmsRenderer(symbol, map.getBounds()).asGeoJSON();
        map.addFeature(gj);
    };
    stpsdk.onSymbolDeleted = (poid, isUndo) => {
        map.removeFeature(poid);
    };

    //#region COA events
    // The list of COAs is kept from the events: STP sends CoaAdded, CoaModified and CoaDeleted to every client of
    // the session, for this client's own requests as well as for other clients'. The add/update/delete calls are
    // fire-and-forget - these events are their confirmation, and a refusal arrives as an StpMessage
    stpsdk.onCoaAdded = (poid, coa, isUndo, batchId) => {
        coas.set(poid, coa);
        logEvent("CoaAdded " + poid + " '" + coa?.name + "'" + (isUndo ? " (undo)" : "") + (batchId ? " batch " + batchId : ""));
        renderCoas();
    };
    stpsdk.onCoaModified = (poid, coa, isUndo, batchId) => {
        coas.set(poid, coa);
        logEvent("CoaModified " + poid + " '" + coa?.name + "'" + (isUndo ? " (undo)" : ""));
        renderCoas();
    };
    stpsdk.onCoaDeleted = (poid, isUndo, batchId) => {
        coas.delete(poid);
        if (currentCoa === poid) currentCoa = undefined;
        logEvent("CoaDeleted " + poid + (isUndo ? " (undo)" : ""));
        renderCoas();
    };
    // The current COA changed - edits, sketches and imports go into it from now on.
    // A scenario reset clears the current COA: the event then carries no COA
    stpsdk.onCoaSwitched = (coa) => {
        currentCoa = coa?.poid;
        logEvent("CoaSwitched " + (coa?.poid ? coa.poid + " '" + coa.name + "'" : "(none)"));
        renderCoas();
    };
    // The role (and with it the COA the role works on) changed
    stpsdk.onRoleSwitched = (role) => {
        logEvent("RoleSwitched " + (role ?? "(reset)"));
    };
    //#endregion

    //#region COA actions
    // Add: AddCoa takes the new COA's definition. The poid is assigned by STP and comes back in CoaAdded
    document.getElementById('addCoa').onclick = () => {
        const name = document.getElementById('coaName').value.trim();
        if (!name) {
            log("Enter a name for the new COA", "Error");
            return;
        }
        const coa = {
            fsTYPE: 'coa',
            name: name,
            affiliation: document.getElementById('coaAffiliation').value,
            creatorRole: document.getElementById('coaRole').value,
        };
        stpsdk.addCoa(coa);
        log("Requested new COA '" + name + "' - waiting for CoaAdded");
    };
    // Import the last exported COA
    document.getElementById('importCoa').onclick = () => importCoa();
    // Re-read the list from the scenario, for example after joining a session that already had COAs
    document.getElementById('refresh').onclick = async () => {
        try {
            await refreshCoas();
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
    // STP event to be communicated to user - refusals of fire-and-forget calls (AddCoa, UpdateCoa, ...) arrive here
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

//#region COA list
// COAs known to this client, by poid, and the current one
const coas = new Map();
let currentCoa = undefined;

/**
 * Read the scenario's COAs. There is no "list COAs" call: GetAllObjects returns every object of the scenario,
 * and the COAs are the ones whose fsTYPE is 'coa'
 */
async function refreshCoas() {
    const objects = await stpsdk.getAllObjects();
    coas.clear();
    for (const obj of objects ?? []) {
        if (obj?.fsTYPE === 'coa' && obj.poid) {
            coas.set(obj.poid, obj);
        }
    }
    log("Scenario has " + coas.size + " COA(s)");
    renderCoas();
}

async function afterJoin() {
    await refreshCoas();
}

/**
 * Show the COAs with their actions
 */
function renderCoas() {
    const body = document.getElementById('coaRows');
    body.innerHTML = '';
    for (const [poid, coa] of coas) {
        const row = document.createElement('tr');
        if (poid === currentCoa) row.className = 'current';
        row.innerHTML =
            '<td>' + esc(coa.name) + '<br><small>' + esc(poid) + '</small></td>' +
            '<td>' + esc(coa.affiliation) + '</td>' +
            '<td>' + esc(coa.creatorRole) +
                (coa.friendTaskOrg || coa.hostileTaskOrg ? '<br><small>TO ' + esc(coa.friendTaskOrg ?? coa.hostileTaskOrg) + '</small>' : '') +
            '</td>' +
            '<td>' +
                '<button data-act="current">Current</button> ' +
                '<button data-act="rename">Rename</button> ' +
                '<button data-act="delete">Delete</button><br>' +
                '<button data-act="export">Export</button> ' +
                '<button data-act="to">Task org</button> ' +
                '<button data-act="clearto">Clear TO</button>' +
            '</td>';
        row.querySelector('[data-act=current]').onclick = () => setCurrent(poid);
        row.querySelector('[data-act=rename]').onclick = () => rename(poid);
        row.querySelector('[data-act=delete]').onclick = () => remove(poid);
        row.querySelector('[data-act=export]').onclick = () => exportCoa(poid);
        row.querySelector('[data-act=to]').onclick = () => bindTaskOrg(poid);
        row.querySelector('[data-act=clearto]').onclick = () => clearTaskOrg(poid);
        body.appendChild(row);
    }
}

/**
 * Make a COA the current one. SetCurrentCoa is a request: it resolves once STP accepted it, and CoaSwitched
 * follows unless the COA was already current. An unknown or deleted COA is refused (the promise rejects)
 */
async function setCurrent(poid) {
    try {
        await stpsdk.setCurrentCoa(poid);
        log("COA " + poid + " is current");
    } catch (error) {
        log(error, 'Error');
    }
}

/**
 * Change a COA's definition - here its name. UpdateCoa sends the whole definition; it is fire-and-forget and
 * CoaModified confirms it
 */
function rename(poid) {
    const coa = coas.get(poid);
    const name = prompt("New name for the COA", coa?.name ?? '');
    if (!name) return;
    stpsdk.updateCoa(poid, { ...coa, name: name });
    log("Requested rename of " + poid + " - waiting for CoaModified");
}

/**
 * Delete a COA. DeleteCoa is fire-and-forget; CoaDeleted confirms it
 */
function remove(poid) {
    if (!confirm("Delete COA '" + (coas.get(poid)?.name ?? poid) + "'?")) return;
    stpsdk.deleteCoa(poid);
    log("Requested delete of " + poid + " - waiting for CoaDeleted");
}

// The text of the last exported COA, ready to be imported back
let coaContent = '';

/**
 * Get a COA - its definition with its units, graphics and tasks - as text ready to be persisted.
 * Task org units and relationships are not part of it
 */
async function exportCoa(poid) {
    try {
        coaContent = await stpsdk.getCoaContent(poid);
        log("COA " + poid + " exported (" + coaContent.length + " characters) - delete it and Import to bring it back");
    } catch (error) {
        log(error, 'Error');
    }
}

/**
 * Import a COA from text. The poids in the text are kept as they are - the COA's and its symbols' - so this brings
 * back the very COA that was exported, not a copy of it. CoaAdded follows; the result is the COA's poid
 */
async function importCoa() {
    if (!coaContent) {
        log("Export a COA first", "Error");
        return;
    }
    try {
        const poid = await stpsdk.importCoaContent(coaContent);
        log("COA " + poid + " imported");
    } catch (error) {
        log(error, 'Error');
    }
}

/**
 * Tie a task org to this COA: while the COA is current it uses that task org instead of the default one for the
 * task org's affiliation
 */
async function bindTaskOrg(poid) {
    const toPoid = prompt("Poid of the task org to use with this COA");
    if (!toPoid) return;
    try {
        await stpsdk.setCoaTaskOrg(toPoid, poid);
        log("Task org " + toPoid + " tied to COA " + poid);
    } catch (error) {
        // Engines before STP-1077 refuse a per-COA task org
        log(error, 'Error');
    }
}

/**
 * Clear the task org tied to this COA (for every affiliation); the COA falls back to the default task org.
 * The task org itself is not deleted
 */
async function clearTaskOrg(poid) {
    try {
        await stpsdk.resetCoaTaskOrg({ coaPoid: poid });
        log("Task org selection of COA " + poid + " cleared");
    } catch (error) {
        log(error, 'Error');
    }
}
//#endregion
