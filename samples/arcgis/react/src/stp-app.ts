/**
 * STP application logic — extracted from the vanilla c2sim-arcgis sample.
 *
 * The code below is intentionally kept as close to the original index.ts as
 * possible.  The only structural change is:
 *   • `window.onload = () => start()` → exported `startStpApp()` called by
 *     React after mount.
 *   • The `log()` helper forwards to a React callback so the message bar is
 *     rendered by React state rather than direct DOM mutation.
 *
 * Everything else — event wiring, button handlers, map initialisation — is
 * unchanged so the proven logic is preserved.
 */

import { saveToFile, loadFromFile } from './file-io';

// ── Global SDKs loaded via <script> tags ────────────────────────────────────
declare const StpSDK: any;
declare const StpAS: any;
declare const ArcGISMap: any;

// ── Config defaults (overridden via query-string) ───────────────────────────
let azureSubscriptionKey: string = '<Enter your Azure Speech subscription key here>';
let azureServiceRegion: string = '<Enter Azure\'s subscription region>';
let azureLanguage: string = 'en-US';
let azureEndPoint: string | null = null;

let mapCenter = { lat: 58.967774948, lon: 11.196062412 };
let zoomLevel = 13;
let webSocketUrl = 'ws://<STP server>:<STP port>';

let stpsdk: any | null;
let map: any;
let toPoid: string | undefined;

// React callbacks set by the caller of startStpApp()
let logToReact: (msg: string, color: string) => void = () => {};
let busyToReact: (isBusy: boolean) => void = () => {};
let connectedToReact: (isConnected: boolean) => void = () => {};
let toSwitchedToReact: (name: string, affiliation: string) => void = () => {};
let roleSwitchedToReact: (role: string) => void = () => {};

/**
 * Wrap an async operation so the UI shows a spinner while it runs.
 * `label` is shown in the message bar during the operation.
 */
async function withProgress<T>(label: string, fn: () => Promise<T>): Promise<T> {
  log(label + '...');
  busyToReact(true);
  try {
    return await fn();
  } finally {
    busyToReact(false);
  }
}

// ── Public entry point ──────────────────────────────────────────────────────
export function startStpApp(
  onLog: (msg: string, color: string) => void,
  onBusy: (isBusy: boolean) => void,
  onConnected: (isConnected: boolean) => void,
  onToSwitched: (name: string, affiliation: string) => void,
  onRoleSwitched: (role: string) => void
) {
  logToReact = onLog;
  busyToReact = onBusy;
  connectedToReact = onConnected;
  toSwitchedToReact = onToSwitched;
  roleSwitchedToReact = onRoleSwitched;

  window.onerror = (msg, url, line, col) => {
    try {
      const extra = !col ? '' : '\ncolumn: ' + col;
      if (!msg && line === 0) {
        log('Unexpected Error: ' + msg + ' url: ' + url + ' line: ' + line + extra, 'Error', true);
        return true as any;
      }
    } catch (_) { /* ignore */ }
  };

  start();
}

// ── Original start() — logic preserved as-is ───────────────────────────────
async function start() {
  const urlParams = new URLSearchParams(window.location.search);
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
  const machineId = urlParams.get('machineid') ?? undefined;

  const stpParm = urlParams.get('stpurl');
  if (stpParm) webSocketUrl = stpParm;
  const mapKey = urlParams.get('mapkey') ?? null;

  // MIL-STD-2525 dictionary style configuration
  const milStyleUrl =
    urlParams.get('mil2525StyleUrl')
    ?? urlParams.get('milstyleurl')
    ?? urlParams.get('milstylurl')
    ?? (window as any).MIL2525_STYLE_URL
    ?? undefined;
  const milStylePortalId =
    urlParams.get('mil2525PortalItemId')
    ?? urlParams.get('milstyle')
    ?? (window as any).MIL2525_PORTAL_ITEM_ID
    ?? undefined;

  const appName = 'SdkC2SIMArcGIS';
  const stpconn = new StpSDK.StpWebSocketsConnector(webSocketUrl);
  stpsdk = new StpSDK.StpRecognizer(stpconn);

  // ── Event wiring ────────────────────────────────────────────────────────
  stpsdk.onSymbolAdded = (alternates: any[], isUndo: boolean) => {
    try { const gj = alternates[0].asGeoJSON(); map.addFeature(gj); } catch (e: any) { log(e.message, 'Warning'); }
  };
  stpsdk.onSymbolModified = (poid: string, symbol: any, isUndo: boolean) => {
    try { map.removeFeature(poid); const gj = symbol.asGeoJSON(); map.addFeature(gj); } catch (e: any) { log(e.message, 'Warning'); }
  };
  stpsdk.onSymbolDeleted = (poid: string, isUndo: boolean) => { map.removeFeature(poid); };

  const roleSelect = document.getElementById('roles') as HTMLSelectElement;
  stpsdk.onRoleSwitched = (role?: string) => {
    try {
      if (!role) { log('Role was reset', 'Info'); roleSelect.value = 'none'; roleSwitchedToReact('none'); }
      else { roleSelect.value = role; log('Role switched to: ' + role, 'Info'); roleSwitchedToReact(role); }
    } catch (error: any) { log(error.message, 'Warning'); }
  };

  stpsdk.onTaskOrgAdded = (taskOrg: any) => { log('Task Org added: ' + taskOrg.name, 'Info'); };
  stpsdk.onTaskOrgModified = (poid: string, taskOrg: any) => { log('Task Org modified: ' + poid + ' ' + taskOrg.name, 'Info'); };
  stpsdk.onTaskOrgDeleted = (poid: string) => { log('Task Org deleted: ' + poid, 'Info'); };

  stpsdk.onTaskOrgUnitAdded = (toUnit: any) => { log('Task Org Unit added: ' + toUnit.fullDescription, 'Info'); };
  stpsdk.onTaskOrgUnitModified = (poid: string, toUnit: any) => { log('Task Org Unit modified: ' + poid + ' ' + toUnit.fullDescription, 'Info'); };
  stpsdk.onTaskOrgUnitDeleted = (poid: string) => { log('Task Org Unit deleted: ' + poid, 'Info'); };

  stpsdk.onTaskOrgRelationshipAdded = (toRel: any) => { log('Task Org Relationship added: ' + toRel.poid, 'Info'); };
  stpsdk.onTaskOrgRelationshipModified = (poid: string) => { log('Task Org Relationship modified: ' + poid, 'Info'); };
  stpsdk.onTaskOrgRelationshipDeleted = (poid: string) => { log('Task Org Relationship deleted: ' + poid, 'Info'); };

  stpsdk.onTaskOrgSwitched = (taskOrg?: any) => {
    try {
      const toName = document.getElementById('toName') as HTMLElement;
      toName.innerText = taskOrg?.name ?? 'none';
      toPoid = taskOrg?.poid;
      const affiliation = taskOrg?.affiliation ?? '';
      if (affiliation == 'friend') toName.style.color = 'blue';
      else if (affiliation == 'hostile') toName.style.color = 'red';
      else toName.style.color = 'gray';
      toSwitchedToReact(taskOrg?.name ?? 'none', affiliation);
      log('Task Org switched to: ' + taskOrg?.poid, 'Info');
    } catch (error: any) { log(error.message, 'Warning'); }
  };

  stpsdk.onTaskAdded = (_poid: string, alternates: any[]) => { log('Task added: ' + alternates[0].description, 'Info'); };
  stpsdk.onTaskModified = (poid: string, alternates: any[]) => { log('Task modified: ' + poid + ' ' + alternates[0].description, 'Info'); };
  stpsdk.onTaskDeleted = (poid: string) => { log('Task removed: ' + poid, 'Info'); };

  stpsdk.onSymbolEdited = (operation: string, location: any) => { log('Symbol edit operation: ' + operation + ' gesture:' + location.shape, 'Info'); };
  stpsdk.onMapOperation = (operation: string, location: any) => { log('Map operation: ' + operation + ' gesture:' + location.shape, 'Info'); };
  stpsdk.onCommand = (operation: string, location: any) => { log('Command: ' + operation + ' gesture:' + location.shape, 'Info'); map.addPoly(location.coords); };

  stpsdk.onInkProcessed = () => { map.clearInk(); };
  stpsdk.onSpeechRecognized = (phrases: string[]) => { const speech = (phrases && phrases.length > 0) ? phrases[0] : ''; log(speech); };
  stpsdk.onStpMessage = (msg: string, level: string) => { log(msg, level, true); };

  // ── Button handlers ─────────────────────────────────────────────────────
  const buttonNew = document.getElementById('new') as HTMLButtonElement;
  buttonNew.onclick = async () => { try { await withProgress('Creating new scenario', () => stpsdk!.createNewScenario(appName)); log('New scenario created'); } catch (error) { log(String(error), 'Error'); } };

  const buttonJoin = document.getElementById('join') as HTMLButtonElement;
  buttonJoin.onclick = async () => { try { if (await stpsdk!.hasActiveScenario()) { await withProgress('Joining scenario', () => stpsdk!.joinScenarioSession()); log('Joined scenario'); } else { log('No Active Scenario'); } } catch (error) { log(String(error), 'Error'); } };

  const buttonSave = document.getElementById('save') as HTMLButtonElement;
  buttonSave.onclick = async () => {
    try {
      if (await stpsdk!.hasActiveScenario()) {
        const content = await withProgress('Retrieving scenario', () => stpsdk!.getScenarioContent()) as string;
        const saved = await saveToFile(content, 'scenario.op', 'Scenario files', ['.op']);
        if (saved) log('Scenario saved to ' + saved);
        else log('Save cancelled');
      } else { log('No Active Scenario'); }
    } catch (error) { log(String(error), 'Error'); }
  };

  const buttonLoad = document.getElementById('load') as HTMLButtonElement;
  buttonLoad.onclick = async () => {
    try {
      const result = await loadFromFile('Scenario files', ['.op']);
      if (result) {
        await withProgress('Loading scenario from ' + result.name, () => stpsdk!.loadNewScenario(result.content, 90));
        log('Loaded scenario from ' + result.name);
      } else { log('Load cancelled'); }
    } catch (error) { log(String(error), 'Error'); }
  };

  const buttonSync = document.getElementById('sync') as HTMLButtonElement;
  buttonSync.onclick = async () => {
    try {
      const result = await loadFromFile('Scenario files', ['.op']);
      if (result) {
        await withProgress('Syncing scenario from ' + result.name, () => stpsdk!.syncScenarioSession(result.content, 90));
        log('Synced scenario from ' + result.name);
      } else { log('Sync cancelled'); }
    } catch (error) { log(String(error), 'Error'); }
  };

  const buttonGetTO = document.getElementById('getto') as HTMLButtonElement;
  buttonGetTO.onclick = async () => {
    try {
      if (toPoid) {
        const toContent = await withProgress('Retrieving Task Org', () => stpsdk!.getTaskOrgContent(toPoid)) as string;
        const saved = await saveToFile(toContent, 'taskorg.org', 'ORBAT files', ['.org']);
        if (saved) log('TO saved to ' + saved);
        else log('Save cancelled');
      } else {
        log('Nothing to retrieve. Load a TO first');
      }
    } catch (error) { log(String(error), 'Error'); }
  };

  let toFriend: string | undefined = undefined;
  const buttonFriend = document.getElementById('friend') as HTMLButtonElement;
  buttonFriend.onclick = async () => {
    try {
      const result = await loadFromFile('ORBAT files (Friend)', ['.org']);
      if (result) {
        toFriend = await withProgress('Importing Friend TO from ' + result.name, () => stpsdk!.importTaskOrgContent(result.content));
        await stpsdk!.setDefaultTaskOrg(toFriend);
        log('Friendly TO loaded from ' + result.name + ' (id ' + toFriend + ')');
      } else { log('Load cancelled'); }
    } catch (error) { log(String(error), 'Error'); }
  };

  let toHostile: string | undefined = undefined;
  const buttonHostile = document.getElementById('hostile') as HTMLButtonElement;
  buttonHostile.onclick = async () => {
    try {
      const result = await loadFromFile('ORBAT files (Hostile)', ['.org']);
      if (result) {
        toHostile = await withProgress('Importing Hostile TO from ' + result.name, () => stpsdk!.importTaskOrgContent(result.content));
        await stpsdk!.setDefaultTaskOrg(toHostile);
        log('Hostile TO loaded from ' + result.name + ' (id ' + toHostile + ')');
      } else { log('Load cancelled'); }
    } catch (error) { log(String(error), 'Error'); }
  };

  let selectedRole: string | undefined = undefined;
  roleSelect.onchange = async () => {
    try {
      selectedRole = roleSelect.value;
      roleSelect.value = 'none';
      log('Requesting role switch to ' + selectedRole);
      const roleMap: Record<string, any> = { s2: StpSDK.StpRole.s2, s3: StpSDK.StpRole.s3, s4: StpSDK.StpRole.s4, fso: StpSDK.StpRole.fso, eng: StpSDK.StpRole.eng };
      if (selectedRole && roleMap[selectedRole]) {
        await stpsdk!.setCurrentRole(roleMap[selectedRole]);
      }
    }
    catch (error) { log(String(error), 'Error'); }
  };

  // ── C2SIM proxy ─────────────────────────────────────────────────────────
  const c2simOpts = new StpSDK.StpC2SIMOptions();
  c2simOpts.serverProtocol = '1.0.2';
  const c2simProxy = stpsdk.createC2SIMProxy(c2simOpts);

  const buttonExport = document.getElementById('export') as HTMLButtonElement;
  const affilSelect = document.getElementById('affiliation') as HTMLSelectElement;
  const typesSelect = document.getElementById('types') as HTMLSelectElement;
  buttonExport.onclick = async () => {
    try {
      if (await stpsdk!.hasActiveScenario()) {
        const typeArg = (typesSelect.value === 'Initialization' ? 'initialization' : 'order') as 'initialization' | 'order';
        const affArg = (affilSelect.value === 'friend' ? 'friend' : (affilSelect.value === 'hostile' ? 'hostile' : 'all')) as 'friend' | 'hostile' | 'all';
        await withProgress('Exporting ' + typesSelect.value + ' to C2SIM', () => c2simProxy.exportPlanDataToC2SIMServer('C2SIMSample', typeArg, affArg));
        log(typesSelect.value + ' exported to C2SIM');
      } else { log('No Active Scenario to export'); }
    } catch (error) { log(String(error), 'Error'); }
  };

  const buttonImport = document.getElementById('import') as HTMLButtonElement;
  buttonImport.onclick = async () => {
    try { if (!await stpsdk!.hasActiveScenario()) { await stpsdk!.createNewScenario(appName); log('New scenario created'); } await withProgress('Importing C2SIM Initialization', () => c2simProxy.importInitializationFromC2SIMServer()); log('Initialization imported from C2SIM into the current scenario'); }
    catch (error) { log(String(error), 'Error'); }
  };
  c2simProxy.onSymbolReport = (poid: string, symbol: any) => { map.removeFeature(poid); try { const gj = symbol.asGeoJSON(); map.addFeature(gj); } catch (e: any) { log(e.message, 'Warning'); } };

  // ── Connect button ──────────────────────────────────────────────────────
  const buttonConnect = document.getElementById('connect') as HTMLButtonElement;
  buttonConnect.onclick = async () => {
    try {
      const sessionBox = document.getElementById('sessionId') as HTMLInputElement;
      const session = sessionBox.value;
      sessionBox.value = (await withProgress('Connecting to STP', () => stpsdk!.connect(appName, 30, machineId ?? undefined, session))) ?? '';
      connectedToReact(true);
      runApp(appName);
    } catch (_) {
      const msg = 'Failed to connect to STP at ' + webSocketUrl + '. \nSymbols will not be recognized. Please reload to try again';
      log(msg, 'Error', true);
      return;
    }
  };

  // ── Speech recogniser ───────────────────────────────────────────────────
  let speechreco: any | null;
  if (inkOnly != null) {
    speechreco = null;
  } else {
    speechreco = new StpAS.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint, null as any, azureLanguage);
    speechreco.onRecognized = (recoResult: any) => {
      if (recoResult && recoResult.results && recoResult.results.length > 0) {
        speechreco!.stopRecognizing();
        stpsdk!.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
        const concat = recoResult.results.map((item: any) => item.text).join(' | ');
        log(concat);
      }
    };
    speechreco.onRecognizing = (snippet: string) => { log(snippet); };
    speechreco.onError = (e: any) => { log('Failed to process speech: ' + e.message); };
  }

  // ── Map initialisation ──────────────────────────────────────────────────
  map = new ArcGISMap(mapKey, 'map', mapCenter, zoomLevel, {
    mil2525StyleUrl: milStyleUrl,
    mil2525PortalItemId: milStylePortalId
  });

  map.onStrokeStart = (location: any, timestamp: string) => {
    stpsdk!.sendPenDown(location, timestamp);
    if (speechreco) {
      log('Speech: start recognizing', 'Info');
      speechreco.startRecognizing();
    }
  };

  map.onStrokeCompleted = (
    pixelBoundsWindow: any,
    topLeftGeoMap: any,
    bottomRightGeoMap: any,
    strokePoints: any,
    timeStrokeStart: string,
    timeStrokeEnd: string,
    intersectedPoids: string[]
  ) => {
    stpsdk!.sendInk(
      pixelBoundsWindow,
      topLeftGeoMap,
      bottomRightGeoMap,
      strokePoints,
      timeStrokeStart,
      timeStrokeEnd,
      intersectedPoids
    );
    if (speechreco) {
      log('Speech: stop recognizing (5s timeout)', 'Info');
      speechreco.stopRecognizing(5000);
    }
  };

  map.onSelection = (symbol: any) => {
    const contentString = buildInfo(symbol);
    if (contentString && symbol && symbol.poid && symbol.location && symbol.location.centroid) {
      map.displayInfo(contentString, symbol.location.centroid, [
        { selector: '#delButton', handler: () => { stpsdk!.deleteSymbol(symbol.poid); }, closeInfo: true }
      ]);
    }
  };
}

// ── runApp — unchanged ──────────────────────────────────────────────────────
async function runApp(appName: string) {
  map.load();
  if (!await stpsdk!.hasActiveScenario()) {
    log('STP session has no active scenario - creating new');
    await stpsdk!.createNewScenario(appName);
    log('New scenario created');
  } else {
    log('STP session has active scenario - Join or Sync to display content');
  }
}

// ── buildInfo — unchanged ───────────────────────────────────────────────────
function buildInfo(symbol: any) {
  if (!symbol || !symbol.location || !symbol.location.centroid) return null;
  let contentString =
    '<h3 id="firstHeading" class="firstHeading">' + (symbol.fullDescription ?? symbol.description ?? 'Symbol') + '</h3>' +
    '<table>' +
    '<tr>' + '<td>2525D PartA</td><td>' + (symbol.sidc?.partA ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>2525D PartB</td><td>' + (symbol.sidc?.partB ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Symbol Set</td><td>' + (symbol.sidc?.symbolSet ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>2525C SIDC</td><td>' + (symbol.sidc?.legacy ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Affiliation</td><td>' + (symbol.affiliation ?? '') + '</td>' + '</tr>';
  if (symbol.fsTYPE == 'unit') {
    contentString += '<tr>' + '<td>Echelon</td><td>' + (symbol.echelon ?? '') + '</td>' + '</tr>';
  }
  contentString +=
    '<tr>' + '<td>Parent Unit</td><td>' + (symbol.parent ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Designator 1</td><td>' + (symbol.designator1 ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Designator 2</td><td>' + (symbol.designator2 ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Status</td><td>' + (symbol.status ?? '') + '</td>' + '</tr>';
  if (symbol.fsTYPE == 'unit') {
    contentString +=
      '<tr>' + '<td>Modifier</td><td>' + (symbol.modifier ?? '') + '</td>' + '</tr>' +
      '<tr>' + '<td>Strength</td><td>' + (symbol.strength ?? '') + '</td>' + '</tr>' +
      '<tr>' + '<td>Branch</td><td>' + (symbol.branch ?? '') + '</td>' + '</tr>';
  }
  contentString +=
    '<tr>' + '<td>Time From</td><td>' + (symbol.timeFrom ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Time To</td><td>' + (symbol.timeTo ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Altitude</td><td>' + (symbol.altitude ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Min Altitude</td><td>' + (symbol.minAltitude ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td>Max Altitude</td><td>' + (symbol.maxAltitude ?? '') + '</td>' + '</tr>' +
    '<tr>' + '<td><button id="delButton">Delete</button></td>' + '</tr>' +
    '</table>';
  return contentString;
}

// ── log — forwards to React state for the message bar ───────────────────────
function log(msg: string, level: string = 'Info', showAlert: boolean = false) {
  if (showAlert) { alert(msg); }
  const color = level === 'Error' ? 'red' : 'black';
  logToReact(msg, color);
}
