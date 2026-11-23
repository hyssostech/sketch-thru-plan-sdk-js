///////////////////////////////////////////////////////////////////////////////////////////////////////
let webSocketUrl  = "wss://<STP server/proxy_path>";// or "ws://<STP server>:<STP port>" for a local server without TLS
// An invented index that ships with this repository's contract, for trying the search without STP.
// Its symbols are made up (Zephyr, Zephyr Lance, ...): search for "zephyr"
let indexUrl = "../../json-api/symbol-search/fixture-index.json";
//////////////////////////////////////////////////////////////////////////////////////////////////////+*/

window.onload = () => start();

//#region STP functions
let stpsdk;
// The loaded search, once an index has been read
let symbolSearch;

async function start() {
    // Retrieve (optional) querystring parameters
    // 'stpurl' - STP Websockets URL
    // 'indexurl' - URL of a symbol index to load instead of STP's
    const urlParams = new URLSearchParams(window.location.search);
    const stpParm = urlParams.get('stpurl');
    if (stpParm) webSocketUrl = stpParm;
    const indexParm = urlParams.get('indexurl');
    if (indexParm) indexUrl = indexParm;
    document.getElementById('indexUrl').value = indexUrl;

    const appName = "SdkSymbolSearchSample";

    // SearchSymbol is answered by the SDK itself, from the symbol index it loads - the engine never receives it.
    // The index ships with STP and is served by the bridge this client connects to
    document.getElementById('connect').onclick = async () => {
        try {
            const sessionBox = document.getElementById('sessionId');
            const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
            stpsdk = new StpSDK.StpRecognizer(stpconn);
            sessionBox.value = await stpsdk.connect(appName, 30, undefined, sessionBox.value);
            // With no URL, load() reads the index served by the bridge the connector just connected to
            await loadIndex(undefined);
        } catch (error) {
            log("Failed to connect to STP at " + webSocketUrl + ": " + (error?.message ?? error), "Error");
        }
    };

    // Any index file that follows json-api/sketch-thru-plan-symbol-index.schema.json can be loaded by URL
    document.getElementById('loadUrl').onclick = () => loadIndex(document.getElementById('indexUrl').value);

    // Search as the user types
    document.getElementById('text').oninput = () => search();
    document.getElementById('maxResults').oninput = () => search();
}

/**
 * Load a symbol index
 * @param url - URL of the index; undefined for the index of the STP the connector is connected to
 */
async function loadIndex(url) {
    try {
        symbolSearch = await StpSDK.SymbolSearch.load(url);
        document.getElementById('text').disabled = false;
        log("Symbol index loaded from " + (url ?? "STP") + " - type to search");
        search();
    } catch (error) {
        // A missing index is an error, never an empty result: "symbol index not available: <source> (<reason>)".
        // An STP older than the symbol search, a missing install or a bad file each give their reason
        symbolSearch = undefined;
        document.getElementById('text').disabled = true;
        log(error?.message ?? String(error), "Error");
    }
}

/**
 * Search the loaded index. Results come best first; text of only spaces or stop words, or no match, gives []
 */
function search() {
    if (!symbolSearch) return;
    const text = document.getElementById('text').value;
    const maxResults = parseInt(document.getElementById('maxResults').value) || 20;
    const results = symbolSearch.search(text, maxResults);
    const body = document.getElementById('results');
    body.innerHTML = '';
    for (const r of results) {
        const row = document.createElement('tr');
        row.innerHTML =
            '<td>' + esc(r.name) + '</td>' +
            '<td>' + esc(r.speech) + '</td>' +
            '<td>' + esc(r.gesture) + '</td>' +
            '<td>' + esc(r.defaultAffiliation) + '</td>' +
            '<td>' + esc(r.deltaSidc) + '</td>' +
            '<td>' + esc(r.charlieSidc) + '</td>' +
            '<td>' + esc(r.key) + '</td>' +
            '<td>' + r.score.toFixed(3) + '</td>';
        body.appendChild(row);
    }
    if (text.trim()) log(results.length + " result(s) for '" + text + "'");
}
//#endregion

//#region Utility functions
/**
 * Show the latest message in the status line
 * @param msg - Message to display
 * @param level - Level of criticality of the message
 */
function log(msg, level='Info') {
    let control = document.getElementById("messages")
    control.textContent = msg;
    control.style.color =  level === "Error" ? "red" : "black";
}

/**
 * Escape text before placing it in HTML
 */
function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
//#endregion
