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

    const appName = "SdkTaskHistorySample";

    // Create an STP connection object - using a websocket connection to STP's native pub/sub system
    const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
    // The task history names this user as the author of this client's edits and comments.
    // It must be set before connecting: a client that registers without a user cannot add comments
    stpconn.user = userName;

    // Initialize the STP recognizer with the connector definition
    stpsdk = new StpSDK.StpRecognizer(stpconn);

    // Hook up to the events _before_ connecting, so that the correct message subscriptions can be identified
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

    //#region Task events - the list of tasks to pick from
    stpsdk.onTaskAdded = (poid, alternates, taskPoids, isUndo) => {
        tasks.set(poid, { description: alternates[0]?.description, deleted: false });
        renderTasks();
    };
    stpsdk.onTaskModified = (poid, alternates, taskPoids, isUndo) => {
        tasks.set(poid, { description: alternates[0]?.description, deleted: false });
        renderTasks();
    };
    // A deleted task keeps its history - keep it in the list, marked as deleted
    stpsdk.onTaskDeleted = (poid, isUndo) => {
        const task = tasks.get(poid) ?? { description: poid };
        task.deleted = true;
        tasks.set(poid, task);
        renderTasks();
    };
    //#endregion

    //#region Task history events
    // A task's history gained an entry: an edit, a retask, a confirm, a delete, an undo - by any client - or a comment.
    // `poid` is the ENTRY's poid (what EditTaskComment and DeleteTaskComment take); entry.task is the task's poid
    stpsdk.onTaskEventAdded = (poid, entry, batchId) => {
        logEvent("TaskEventAdded " + entry.kind + " on " + entry.task + " by " + (entry.author || "-") + (batchId ? " batch " + batchId : ""));
        if (entry.task === selectedTask) {
            taskHistory.unshift({ poid, entry });
            renderHistory();
        }
    };
    // A comment was edited or deleted by its author; the entry arrives whole (a deleted comment as its tombstone)
    stpsdk.onTaskEventModified = (poid, entry, batchId) => {
        logEvent("TaskEventModified " + poid + (entry.deleted ? " (deleted)" : " (edited)"));
        const item = taskHistory.find((h) => h.poid === poid);
        if (item) {
            item.entry = entry;
            renderHistory();
        }
    };
    //#endregion

    //#region Comment actions
    // AddTaskComment answers the new entry's poid; TaskEventAdded then reaches every client, this one included
    document.getElementById('addComment').onclick = async () => {
        const box = document.getElementById('commentText');
        if (!selectedTask) {
            log("Select a task first", "Error");
            return;
        }
        try {
            const entryPoid = await stpsdk.addTaskComment(selectedTask, box.value);
            box.value = '';
            log("Comment added: " + entryPoid);
        } catch (error) {
            // Refused for blank text, or when this client registered without a user
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

//#region Task list and history display
// Tasks seen by this client, by poid, the selected task and its history (newest first)
const tasks = new Map();
let selectedTask = undefined;
let taskHistory = [];

async function afterJoin() {
    // Tasks arrive as TaskAdded events while joining - nothing else to read
}

function renderTasks() {
    const body = document.getElementById('taskRows');
    body.innerHTML = '';
    for (const [poid, task] of tasks) {
        const row = document.createElement('tr');
        if (poid === selectedTask) row.className = 'current';
        row.innerHTML = '<td>' + esc(task.description) + (task.deleted ? ' <i>(deleted)</i>' : '') + '</td>' +
            '<td><button>History</button></td>';
        row.querySelector('button').onclick = () => selectTask(poid);
        body.appendChild(row);
    }
}

/**
 * Read a task's history. GetTaskHistory answers the entries newest first, each with its entry poid;
 * a task with no history, or an unknown poid, answers []
 */
async function selectTask(poid) {
    try {
        selectedTask = poid;
        taskHistory = await stpsdk.getTaskHistory(poid) ?? [];
        renderTasks();
        renderHistory();
    } catch (error) {
        log(error, 'Error');
    }
}

function renderHistory() {
    const body = document.getElementById('historyRows');
    body.innerHTML = '';
    for (const { poid, entry } of taskHistory) {
        const row = document.createElement('tr');
        let text = entry.deleted ? '<i>comment deleted ' + esc(entry.deleted) + '</i>' : esc(entry.text);
        if (entry.edited && !entry.deleted) text += ' <i>(edited)</i>';
        row.innerHTML =
            '<td>' + esc(entry.utc) + '<br><b>' + esc(entry.kind) + '</b></td>' +
            '<td>' + esc(entry.author) + ' ' + esc(entry.role) + '<br><small>' + esc(entry.source) + '</small></td>' +
            '<td>' + text + '</td>' +
            '<td></td>';
        // Only a user's own, standing comments can be edited or deleted - the engine refuses the rest
        if (entry.origin === 'user' && entry.kind === 'comment' && !entry.deleted && entry.author === userName) {
            const edit = document.createElement('button');
            edit.textContent = 'Edit';
            edit.onclick = () => editComment(poid, entry.text);
            const del = document.createElement('button');
            del.textContent = 'Delete';
            del.onclick = () => deleteComment(poid);
            row.lastChild.append(edit, del);
        }
        body.appendChild(row);
    }
}

/**
 * Change the text of this user's comment. The earlier text is kept in the entry's detail (revisions);
 * TaskEventModified carries the updated entry
 */
async function editComment(entryPoid, text) {
    const newText = prompt("Comment", text ?? '');
    if (newText === null) return;
    try {
        await stpsdk.editTaskComment(entryPoid, newText);
    } catch (error) {
        log(error, 'Error');
    }
}

/**
 * Delete this user's comment. It stays in the history as a tombstone, so others see that it was deleted and by whom
 */
async function deleteComment(entryPoid) {
    try {
        await stpsdk.deleteTaskComment(entryPoid);
    } catch (error) {
        log(error, 'Error');
    }
}
//#endregion
