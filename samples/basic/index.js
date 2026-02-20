///////////////////////////////////////////////////////////////////////////////////////////////////////
// Config defaults (overridden by querystring)
let azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
let azureServiceRegion = "<Enter Azure's subscription region>";
let azureLanguage = "en-US";
let azureEndPoint = null;

let googleMapsKey = "<Enter your Google Maps API key here>";
let mapCenter = { lat: 58.967774948, lon: 11.196062412 };
let zoomLevel = 13;

let webSocketUrl  = "ws://<STP server>:<STP port>"; // or wss://<STP server/proxy_path>
///////////////////////////////////////////////////////////////////////////////////////////////////////

let stpsdk;
let map; // IMapAdapter instance
let currentAdapter = null; // 'gmaps' | 'leaflet'

window.onload = () => start();

window.onerror = (msg, url, line, col, error) => {
  try {
    const extra = !col ? '' : '\ncolumn: ' + col;
    if (!msg && line === 0) {
      log('Unexpected Error: ' + msg + ' url: ' + url + ' line: ' + line + extra, 'Error', true);
      return true;
    }
  } catch (e) {
    // Ignore reporting failures
  }
}

async function start(){
  // Read querystring params
  const urlParams = new URLSearchParams(window.location.search);
  const mapSel = (urlParams.get('map') || 'gmaps').toLowerCase();
  const latParm = urlParams.get('lat');
  const lonParm = urlParams.get('lon');
  if (latParm && lonParm) mapCenter = { lat: parseFloat(latParm), lon: parseFloat(lonParm) };
  const zoomParm = urlParams.get('zoom');
  if (zoomParm) zoomLevel = parseInt(zoomParm);

  const azKey = urlParams.get('azkey'); if (azKey) azureSubscriptionKey = azKey;
  const azRegion = urlParams.get('azregion'); if (azRegion) azureServiceRegion = azRegion;
  const azLang = urlParams.get('azlang'); if (azLang) azureLanguage = azLang;
  const azEndp = urlParams.get('azendp'); if (azEndp) azureEndPoint = azEndp;

  const inkOnly = urlParams.get('inkonly');
  const machineId = urlParams.get('machineid');

  const stpParm = urlParams.get('stpurl'); if (stpParm) webSocketUrl =  stpParm;
  const mapKey = urlParams.get('mapkey'); if (mapKey) googleMapsKey = mapKey;

  // UI selector initialization
  const selector = document.getElementById('mapSelector');
  selector.value = (mapSel === 'leaflet' ? 'leaflet' : 'gmaps');
  selector.addEventListener('change', () => {
    const chosen = selector.value;
    // Rebuild page to ensure clean adapter load
    const next = new URL(window.location.href);
    next.searchParams.set('map', chosen);
    window.location.href = next.toString();
  });

  // Create STP connector/recognizer
  const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
  stpsdk = new StpSDK.StpRecognizer(stpconn);

  // Wire STP events (independent of adapter)
  stpsdk.onSymbolAdded = (alternates, isUndo) => {
    const gj = new JmsRenderer(alternates[0], map.getBounds()).asGeoJSON();
    map.addFeature(gj);
  };
  stpsdk.onSymbolModified = (poid, symbol, isUndo) => {
    map.removeFeature(poid);
    const gj = new JmsRenderer(symbol, map.getBounds()).asGeoJSON();
    map.addFeature(gj);
  };
  stpsdk.onSymbolDeleted = (poid, isUndo) => { map.removeFeature(poid); };
  stpsdk.onInkProcessed = () => { map.clearInk(); };
  stpsdk.onSpeechRecognized = (phrases) => {
    let speech = "";
    if (phrases && phrases.length > 0) {
      if (inkOnly != null && /[a-z]/.test(phrases[0].charAt(0))) {
        speech = phrases.slice(0,5).join(' | ');
      } else {
        speech = phrases[0];
      }
    }
    log(speech);
  };
  stpsdk.onStpMessage = (msg, level) => { log(msg, level, true); };

  // Attempt to connect to STP
  try {
    await stpsdk.connect("SdkMapSample", 10, machineId);
  } catch (error) {
    const msg = "Failed to connect to STP at " + webSocketUrl + ". \nSymbols will not be recognized. Please reload to try again";
    log(msg, "Error", true);
    return;
  }

  // Speech recognizer (unless inkOnly)
  let speechreco;
  if (inkOnly != null) {
    speechreco = null;
  } else {
    speechreco = new StpAS.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint, null, azureLanguage);
    speechreco.onRecognized = (recoResult) => {
      if (recoResult && recoResult.results && recoResult.results.length > 0) {
        speechreco.stopRecognizing();
        stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
        const concat = recoResult.results.map((item) => item.text).join(' | ');
        log(concat);
      }
    };
    speechreco.onRecognizing = (snippet) => { log(snippet); };
    speechreco.onError = (e) => { log("Failed to process speech: " + e.message); };
  }

  // Load selected adapter and create map
  try {
    await loadAdapterAndInit(mapSel, speechreco);
  } catch (e) {
    log("Failed to load adapter: " + e.message, "Error", true);
    return;
  }
}

async function loadAdapterAndInit(target, speechreco) {
  currentAdapter = target === 'leaflet' ? 'leaflet' : 'gmaps';
  // Show status
  setStatus("Loading " + currentAdapter + "...");

  if (currentAdapter === 'leaflet') {
    // Load Leaflet CSS/JS via CDN, then adapter bundle
    await loadCss("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
    await loadScript("../../plugins/maps/leaflet/dist/leaflet-bundle-min.js");
    map = new LeafletMap(null, 'map', mapCenter, zoomLevel);
  } else {
    // Load Google Maps loader, then adapter bundle
    await loadScript("https://unpkg.com/@googlemaps/js-api-loader@1.x/dist/index.min.js");
    await loadScript("../../plugins/maps/googlemaps/dist/googlemaps-bundle-min.js");
    map = new GoogleMap(googleMapsKey, 'map', mapCenter, zoomLevel);
  }

  // Subscribe to sketching events
  map.onStrokeStart = (location, timestamp) => {
    stpsdk.sendPenDown(location, timestamp);
    speechreco?.startRecognizing();
  };
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
    speechreco?.stopRecognizing(5000);
  };
  map.onSelection = (symbol) => {
    const contentString = buildInfo(symbol);
    if (contentString && symbol && symbol.poid && symbol.location && symbol.location.centroid) {
      map.displayInfo(contentString, symbol.location.centroid,
        [ { selector: '#delButton', handler: (event) => { stpsdk.deleteSymbol(symbol.poid); }, closeInfo: true } ]
      );
    }
  };

  // Load the map UI
  map.load();
  setStatus("Loaded " + currentAdapter);
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text || '';
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load script ' + src));
    document.head.appendChild(s);
  });
}

function loadCss(href) {
  return new Promise((resolve, reject) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = () => resolve();
    l.onerror = () => reject(new Error('Failed to load css ' + href));
    document.head.appendChild(l);
  });
}

function buildInfo(symbol) {
  if (! symbol || ! symbol.location || ! symbol.location.centroid) {
    return null;
  }
  let contentString =
    '<h3 id="firstHeading" class="firstHeading">' + symbol.fullDescription + '</h3>' +
    '<table>'+
      '<tr><td>2525D PartA</td><td>' + (symbol.sidc?.partA ?? '') + '</td></tr>' +
      '<tr><td>2525D PartB</td><td>' + (symbol.sidc?.partB ?? '') + '</td></tr>' +
      '<tr><td>Symbol Set</td><td>' + (symbol.sidc?.symbolSet ?? '') + '</td></tr>' +
      '<tr><td>2525C SIDC</td><td>' + (symbol.sidc?.legacy ?? '') + '</td></tr>' +
      '<tr><td>Affiliation</td><td>' + (symbol.affiliation ?? '') + '</td></tr>';
  if (symbol.fsTYPE === 'unit') {
    contentString += '<tr><td>Echelon</td><td>' + (symbol.echelon ?? '') + '</td></tr>';
  }
  contentString +=
      '<tr><td>Parent Unit</td><td>' + (symbol.parent ?? '') + '</td></tr>' +
      '<tr><td>Designator 1</td><td>' + (symbol.designator1 ?? '') + '</td></tr>' +
      '<tr><td>Designator 2</td><td>' + (symbol.designator2 ?? '') + '</td></tr>' +
      '<tr><td>Status</td><td>' + (symbol.status ?? '') + '</td></tr>';
  if (symbol.fsTYPE === 'unit') {
    contentString +=
      '<tr><td>Modifier</td><td>' + (symbol.modifier ?? '') + '</td></tr>' +
      '<tr><td>Strength</td><td>' + (symbol.strength ?? '') + '</td></tr>';
  }
  contentString +=
      '<tr><td>Time From</td><td>' + (symbol.timeFrom ?? '') + '</td></tr>' +
      '<tr><td>Time To</td><td>' + (symbol.timeTo ?? '') + '</td></tr>' +
      '<tr><td>Altitude</td><td>' + (symbol.altitude ?? '') + '</td></tr>' +
      '<tr><td>Min Altitude</td><td>' + (symbol.minAltitude ?? '') + '</td></tr>' +
      '<tr><td>Max Altitude</td><td>' + (symbol.maxAltitude ?? '') + '</td></tr>' +
      '<tr><td><button id="delButton">Delete</button></td></tr>' +
    '</table>';
  return contentString;
}

function log(msg, level='Info', showAlert = false) {
  if (showAlert) { alert(msg); }
  const control = document.getElementById('messages');
  if (! control) { throw new Error("Html page must contain a 'messages' div"); }
  control.innerHTML = msg;
  control.style.color =  level === 'Error' ? 'red' : 'black';
}
