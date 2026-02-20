// Use global SDKs loaded via script tags
declare const StpSDK: any;
declare const StpAS: any;

// ArcGIS adapter is loaded globally from arcgis-bundle-min.js
declare const ArcGISMap: any;

// Config defaults
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

window.onload = () => start();

window.onerror = (msg, url, line, col) => {
  try {
    const extra = !col ? '' : '\ncolumn: ' + col;
    if (!msg && line === 0) {
      log('Unexpected Error: ' + msg + ' url: ' + url + ' line: ' + line + extra, 'Error', true);
      return true as any;
    }
  } catch (_) { /* ignore */ }
};

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
  // Supports multiple query param aliases and optional globals for convenience:
  // - mil2525StyleUrl OR milstyleurl OR milstylurl
  // - mil2525PortalItemId OR milstyle
  // - window.MIL2525_STYLE_URL or window.MIL2525_PORTAL_ITEM_ID
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

  // Event wiring
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
      if (!role) { log('Role was reset', 'Info'); roleSelect.value = 'none'; }
      else { roleSelect.value = role; log('Role switched to: ' + role, 'Info'); }
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
      if (taskOrg?.affiliation == 'friend') toName.style.color = 'blue';
      else if (taskOrg?.affiliation == 'hostile') toName.style.color = 'red';
      else toName.style.color = 'gray';
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

  const buttonNew = document.getElementById('new') as HTMLButtonElement;
  buttonNew.onclick = async () => { try { await stpsdk!.createNewScenario(appName); log('New scenario created'); } catch (error) { log(String(error), 'Error'); } };

  const buttonJoin = document.getElementById('join') as HTMLButtonElement;
  buttonJoin.onclick = async () => { try { if (await stpsdk!.hasActiveScenario()) { await stpsdk!.joinScenarioSession(); log('Joined scenario'); } else { log('No Active Scenario'); } } catch (error) { log(String(error), 'Error'); } };

  let content = '';
  const buttonSave = document.getElementById('save') as HTMLButtonElement;
  buttonSave.onclick = async () => { try { if (await stpsdk!.hasActiveScenario()) { content = await stpsdk!.getScenarioContent(); log('Saved scenario'); } else { log('No Active Scenario'); } } catch (error) { log(String(error), 'Error'); } };

  const buttonLoad = document.getElementById('load') as HTMLButtonElement;
  buttonLoad.onclick = async () => { try { if (content !== '') { await stpsdk!.loadNewScenario(content, 90); log('Loaded previously Saved scenario data'); } else { log('No scenario data to load - Save first'); } } catch (error) { log(String(error), 'Error'); } };

  const buttonSync = document.getElementById('sync') as HTMLButtonElement;
  buttonSync.onclick = async () => { try { if (content !== '') { await stpsdk!.syncScenarioSession(content, 90); log('Synched (predefined) scenario with session'); } else { log('No scenario data to sync - Save first'); } } catch (error) { log(String(error), 'Error'); } };

  const buttonGetTO = document.getElementById('getto') as HTMLButtonElement;
  buttonGetTO.onclick = async () => {
    try {
      if (toPoid) {
        const toContent = await stpsdk!.getTaskOrgContent(toPoid);
        log('Retrieved content of latest TO (id ' + toPoid + ') ready to save');
      } else {
        log('Nothing to retrieve. Load a TO first');
      }
    } catch (error) { log(String(error), 'Error'); }
  };

  let toFriend: string | undefined = undefined;
  const buttonFriend = document.getElementById('friend') as HTMLButtonElement;
  buttonFriend.onclick = async () => {
    try {
      if (toFriend === undefined) {
        const content = `object_set([\n                    [fsTYPE: task_org, name: '2-69 short', affiliation: friend, poid: idR47DS5VCGL9ZE, date: '2023-05-22T13:40:00Z'],\n                    [fsTYPE: task_org_unit, name: 'ALPHA TWO SIX NINE', designator1: 'A', unit_parent: '2-69', symbol_id: 'SFGPUCIZ---E---', parent_poid: poid(idR47DS5VCGL9ZE), affiliation: friend, echelon: company, poid: 'uuid7e99345a-f15a-4939-b963-0b83b1ec40f0'],\n                    [fsTYPE: task_org_unit, name: '(ONE | FIRST) [ROYAL] IRISH [GUARDS]', designator1: '1', unit_parent: 'A/2-69', symbol_id: 'SFGPUCIZ---D---', parent_poid: poid(idR47DS5VCGL9ZE), affiliation: friend, echelon: platoon, poid: 'uuid5336c5d5-9182-4846-bdd8-5c517869c274'],\n                    [fsTYPE: task_org_relationship, poid: idPNPMCKGE2TPLF, affiliation: friend, parent: poid(uuid7e99345a-f15a-4939-b963-0b83b1ec40f0), relationship: organic, child: poid(uuid5336c5d5-9182-4846-bdd8-5c517869c274), parent_poid: poid(idR47DS5VCGL9ZE)],\n                ])`;
        toFriend = await stpsdk!.importTaskOrgContent(content);
      }
      await stpsdk!.setDefaultTaskOrg(toFriend);
      log('Friendly TO ' + toFriend + ' set as default');
    } catch (error) { log(String(error), 'Error'); }
  };

  let toHostile: string | undefined = undefined;
  const buttonHostile = document.getElementById('hostile') as HTMLButtonElement;
  buttonHostile.onclick = async () => {
    try {
      if (toHostile === undefined) {
        const hostile = `object_set([\n                    [fsTYPE: task_org, name: 'Hostile 1-1', affiliation: hostile, poid: idR47DS5VCGL8AB, date: '2023-05-22T13:40:00Z'],\n                    [fsTYPE: task_org_unit, name: 'B/1-1_INF', designator1: 'B', unit_parent: '1-1', symbol_id: 'SHGPUCIZ---E---', parent_poid: poid(idR47DS5VCGL8AB), affiliation: hostile, echelon: company, poid: uuid7e99345a-f15a-4939-b963-0b83b1ec51a2],\n                    [fsTYPE: task_org_unit, name: '1/B/1-1_INF', designator1: '1', unit_parent: 'B/1-1', symbol_id: 'SHGPUCIZ---D---', parent_poid: poid(idR47DS5VCGL8AB), affiliation: hostile, echelon: platoon, poid: uuid5336c5d5-9182-4846-bdd8-5c517869d342],\n                    [fsTYPE: task_org_relationship, poid: idPNPMCKGE5TRTF, affiliation: hostile, parent: poid(uuid7e99345a-f15a-4939-b963-0b83b1ec51a2), relationship: organic, child: poid(uuid5336c5d5-9182-4846-bdd8-5c517869d342), parent_poid: poid(idR47DS5VCGL8AB)],\n                    ])`;
        toHostile = await stpsdk!.importTaskOrgContent(hostile);
      }
      await stpsdk!.setDefaultTaskOrg(toHostile);
      log('Hostile TO ' + toHostile + ' set as default');
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

  const c2simOpts = new StpSDK.StpC2SIMOptions();
  c2simOpts.serverProtocol = '1.0.2';
  const c2simProxy = stpsdk.createC2SIMProxy(c2simOpts);
  const buttonExport = document.getElementById('export') as HTMLButtonElement;
  const affilSelect = document.getElementById('affiliation') as HTMLSelectElement;
  const typesSelect = document.getElementById('types') as HTMLSelectElement;
  buttonExport.onclick = async () => {
    try {
      if (await stpsdk!.hasActiveScenario()) {
        log('Exporting ' + typesSelect.value + '...');
        const typeArg = (typesSelect.value === 'Initialization' ? 'initialization' : 'order') as 'initialization' | 'order';
        const affArg = (affilSelect.value === 'friend' ? 'friend' : (affilSelect.value === 'hostile' ? 'hostile' : 'all')) as 'friend' | 'hostile' | 'all';
        await c2simProxy.exportPlanDataToC2SIMServer('C2SIMSample', typeArg, affArg);
        log(typesSelect.value + ' exported to C2SIM');
      } else { log('No Active Scenario to export'); }
    } catch (error) { log(String(error), 'Error'); }
  };

  const buttonImport = document.getElementById('import') as HTMLButtonElement;
  buttonImport.onclick = async () => {
    try { if (!await stpsdk!.hasActiveScenario()) { await stpsdk!.createNewScenario(appName); log('New scenario created'); } log('Importing C2SIM Initialization...'); await c2simProxy.importInitializationFromC2SIMServer(); log('Initialization imported from C2SIM into the current scenario'); }
    catch (error) { log(String(error), 'Error'); }
  };
  c2simProxy.onSymbolReport = (poid: string, symbol: any) => { map.removeFeature(poid); try { const gj = symbol.asGeoJSON(); map.addFeature(gj); } catch (e: any) { log(e.message, 'Warning'); } };

  const buttonConnect = document.getElementById('connect') as HTMLButtonElement;
  buttonConnect.onclick = async () => {
    try {
      const sessionBox = document.getElementById('sessionId') as HTMLInputElement;
      const session = sessionBox.value;
      sessionBox.value = (await stpsdk!.connect(appName, 30, machineId ?? undefined, session)) ?? '';
      runApp(appName);
    } catch (_) {
      const msg = 'Failed to connect to STP at ' + webSocketUrl + '. \nSymbols will not be recognized. Please reload to try again';
      log(msg, 'Error', true);
      return;
    }
  };

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

function log(msg: string, level: string = 'Info', showAlert: boolean = false) {
  if (showAlert) { alert(msg); }
  const control = document.getElementById('messages') as HTMLElement | null;
  if (!control) { throw new Error("Html page must contain a 'messages' div"); }
  control.innerHTML = msg;
  control.style.color = level === 'Error' ? 'red' : 'black';
}
