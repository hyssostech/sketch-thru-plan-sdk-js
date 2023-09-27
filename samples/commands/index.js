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
    if (stpParm) webSocketUrl = stpParm;

    const appName = "SdkCommandSample";
    
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
 
    // A new Role became active or was reset
    stpsdk.onRoleSwitched = (role) => {
        try {
            // Display new role on the UI
            if (!role) {
                log("Role was reset", "Info");
                currentRoleBtn = document.querySelector("input[type='radio'][name=role]:checked");
                if (currentRoleBtn) {
                    currentRoleBtn.checked = false;
                }
            }
            else {
                roleBtn = document.getElementById(role);
                roleBtn.checked = true;
                log("Role switched to: " + role, "Info");
            }
        } catch (error) {
            log(error.message, "Warning");
        }
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

    // A new TO became active or was reset
    stpsdk.onTaskOrgSwitched = (taskOrg) => {
        try {
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
            log("Task Org switched to: " + taskOrg?.poid, "Info");
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

    // A new edit operation has been identified
    stpsdk.onSymbolEdited = (operation, location) => {
        try {
            // Display some properties
            log("Symbol edit operation: " + operation + " gesture:" + location.shape, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };

    // A new edit operation has been identified
    stpsdk.onMapOperation = (operation, location) => {
        try {
            // Display some properties
            log("Map operation: " + operation + " gesture:" + location.shape, "Info");
        } catch (error) {
            log(error.message, "Warning");
        }
    };

    // A new edit operation has been identified
    stpsdk.onCommand = (operation, location) => {
        try {
            log("Command: " + operation + " gesture:" + location.shape, "Info");
            map.addPoly(location.coords);
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
            await stpsdk.createNewScenario(appName);
            log("New scenario created");
        } catch (error) {
            log(error, 'Error');
        }
    };
    const buttonJoin = document.getElementById('join');
    buttonJoin.onclick = async () =>  {
        try {
            // TODO: display some sort of progress indicator/wait cursor
            if (await stpsdk.hasActiveScenario()) {
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
    // Save, load, and sync content
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

    const buttonSync = document.getElementById('sync');
    buttonSync.onclick = async () => {
        try {
            if (content == '') {
                content = `object_set([
                    [fsTYPE: planning_scenario,auth: [fsTYPE: auth,source: 'SdkCommandSample_2f5183c8-7071-4e86-bccf-6db9b4844f72',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '2f5183c8-7071-4e86-bccf-6db9b4844f72'],poid: idQL51E9VZPDQ5K45XPBTQAMFV3,name: 'SdkCommandSample',is_valid: true,is_loaded: true,fsdb_version: v6W274K3X2MLL5NA4ZDERQYZ69,fsdb_timestamp: '638272755227979645']
                    [location: [fsTYPE: point,coords: [latlon(20.1848153138375,-155.85812217041)],shape: point,candidate_poids: [],geo_bounds: [latlon(20.2252508598262,-155.9151137475586),latlon(20.025065064308414,-155.5093062524414)],pixel_bounds: [0,0,2364,1242],centroid: latlon(20.1848153138375,-155.85812217041)],fsTYPE: unit,coding_scheme: warfighting,battle_dimension: ground,modifier: none,branch: ground_unit,ground_role: combat,role: infantry,speechPoid: id1K3VUM2TKYX6HXRWK1T395W6M8,echelon: company,designator1: 'A',icon_class: military,affiliation: friend,order_battle: ground,spoken_language: 'infantry company alpha',auth: [fsTYPE: auth,source: 'SdkCommandSample_677c31b4-c1ec-4bbb-a8e4-b240403715ca',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '677c31b4-c1ec-4bbb-a8e4-b240403715ca'],ui_status: confirming,speech: 'infantry company alpha',interval: interval(timeval(1691678736,883),timeval(1691678739,440)),confidence: 0.77865199905425,status: present,symbol_id: 'SFGPUCI----E---',complete_language: 'PRESENT FRIENDLY INFANTRY COMPANY A',placed: true,poid: idFFZQLEXALV3ZL34HYJ19G3STS,glyphPoid: idFFZQLEXALV3ZL34HYJ19G3STS,alt: 0,fsdb_version: v18RV43RHAKXMCUT3FWJ878B9P7,fsdb_timestamp: '638272755427609710']
                    [location: [fsTYPE: point,coords: [latlon(20.1844930760884,-155.760961831055)],shape: point,candidate_poids: [],geo_bounds: [latlon(20.2252508598262,-155.9151137475586),latlon(20.025065064308414,-155.5093062524414)],pixel_bounds: [0,0,2364,1242],centroid: latlon(20.1844930760884,-155.760961831055)],status: anticipated,speechPoid: id1R0FK0ULTSCC666DDM4FU9PQ64,fsTYPE: unit,coding_scheme: warfighting,battle_dimension: ground,modifier: none,branch: ground_unit,ground_role: combat,role: artillery,artillery_type: mortar,echelon: platoon,affiliation: hostile,icon_class: military,order_battle: ground,spoken_language: 'suspected mortar platoon',auth: [fsTYPE: auth,source: 'SdkCommandSample_677c31b4-c1ec-4bbb-a8e4-b240403715ca',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '677c31b4-c1ec-4bbb-a8e4-b240403715ca'],ui_status: confirming,speech: 'suspected mortar platoon',interval: interval(timeval(1691678749,941),timeval(1691678752,175)),confidence: 0.758910717460786,symbol_id: 'SHGAUCFM---D---',complete_language: 'ANTICIPATED ENEMY MORTAR PLATOON',placed: true,poid: id1M9HXCY118TA4H01S96FU0WRS9,glyphPoid: id1M9HXCY118TA4H01S96FU0WRS9,alt: 0,fsdb_version: v1RPWLGLVLP2QCXXAWYGFAQ4N97,fsdb_timestamp: '638272755552876285']
                    [location: [fsTYPE: area,coords: [latlon(20.1952876779402,-155.759760201416),latlon(20.1962543222151,-155.767313302002),latlon(20.1939988095756,-155.77417975708),latlon(20.1907765920101,-155.777098000488),latlon(20.1872320757177,-155.778471291504),latlon(20.1774036770667,-155.778642952881),latlon(20.1725698110816,-155.777269661865),latlon(20.1701528219006,-155.774523079834),latlon(20.1690248807984,-155.771089852295),latlon(20.1680580676475,-155.755811989746),latlon(20.1719252842957,-155.749288857422),latlon(20.1748256338554,-155.748087227783),latlon(20.1803039247265,-155.748430550537),latlon(20.186265375463,-155.751348793945),latlon(20.1914210408548,-155.756841958008),latlon(20.1948043535532,-155.76233512207),latlon(20.1952876779402,-155.759760201416)],shape: area,candidate_poids: [],geo_bounds: [latlon(20.2252508598262,-155.9151137475586),latlon(20.025065064308414,-155.5093062524414)],pixel_bounds: [0,0,2364,1242],centroid: latlon(20.1817303330338,-155.764026340992)],fsTYPE: tg,coding_scheme: tactical_graphics,tg_category: maneuver,overlay: operations,echelon: n_a,tg_maneuver: offense,tg_maneuver_type: n_a,tg_offense: areas,tg_offense_area: objective,geometry: area,abbr: obj,echelon_possible: yes,designator1: 'WILDCATS',speechPoid: idXZHWZVTLUR3TDZR9B2TE3L84T,icon_class: military,affiliation: friend,order_battle: control_markings,spoken_language: 'objective wildcats',auth: [fsTYPE: auth,source: 'SdkCommandSample_677c31b4-c1ec-4bbb-a8e4-b240403715ca',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '677c31b4-c1ec-4bbb-a8e4-b240403715ca'],ui_status: confirming,speech: 'objective wildcats',interval: interval(timeval(1691678762,365),timeval(1691678764,880)),confidence: 0.736059512618663,status: present,symbol_id: 'GFGPOAO--------',complete_language: 'PRESENT FRIENDLY OBJECTIVE WILDCATS',placed: true,poid: idGB9JUXWKE21LGRK8R1BU6R9Q9,glyphPoid: idGB9JUXWKE21LGRK8R1BU6R9Q9,alt: 0,fsdb_version: v3XD3ZWL1WUWMYTE5DKENDWXV9,fsdb_timestamp: '638272755695712769']
                    [location: [fsTYPE: arrowfat,coords: [latlon(20.1783704322813,-155.771776497803),latlon(20.1751478915878,-155.787397683105),latlon(20.1844930760884,-155.853658974609),latlon(20.1786926826874,-155.776583016357)],shape: arrowfat,candidate_poids: [],geo_bounds: [latlon(20.2252508598262,-155.9151137475586),latlon(20.025065064308414,-155.5093062524414)],pixel_bounds: [0,0,2364,1242],centroid: latlon(20.1803709730181,-155.813841489028)],fsTYPE: tg,coding_scheme: tactical_graphics,tg_category: maneuver,overlay: operations,echelon: none,tg_maneuver: offense,tg_maneuver_type: n_a,tg_offense: lines,tg_offense_line: axis_of_advance,geometry: arrowfat,short_form: axis,tg_axis_of_advance: ground,tg_ground_axis: main,designator1: 'LOS ANGELES',speechPoid: id16TF1UB4E1JKWPRNLT50DHHKFR,icon_class: military,affiliation: friend,order_battle: control_markings,modifier: none,spoken_language: 'main attack los angeles',auth: [fsTYPE: auth,source: 'SdkCommandSample_677c31b4-c1ec-4bbb-a8e4-b240403715ca',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '677c31b4-c1ec-4bbb-a8e4-b240403715ca'],ui_status: confirming,speech: 'main attack los angeles',interval: interval(timeval(1691678771,803),timeval(1691678774,141)),confidence: 0.867598608478517,status: present,symbol_id: 'GFGPOLAGM------',complete_language: 'PRESENT FRIENDLY AXIS OF ADVANCE MAIN LOS ANGELES',placed: true,poid: id1KVXNT79YHWMBMDW9NWVAP0D26,glyphPoid: id1KVXNT79YHWMBMDW9NWVAP0D26,alt: 0,fsdb_version: v11TUE74YQU0U4YLQ9GK7NT2DZ3,fsdb_timestamp: '638272755793276100']
                    [location: [fsTYPE: line,coords: [latlon(20.1637073343197,-155.879408181152),latlon(20.1643518950611,-155.874773323975),latlon(20.1521047857236,-155.82430487915),latlon(20.1456585527674,-155.778986275635),latlon(20.1453362341346,-155.763536751709),latlon(20.1490428582497,-155.732637703857),latlon(20.1538774531316,-155.715128243408),latlon(20.1582284605192,-155.7099784021)],shape: line,candidate_poids: [],geo_bounds: [latlon(20.2252508598262,-155.9151137475586),latlon(20.025065064308414,-155.5093062524414)],pixel_bounds: [0,0,2364,1242],centroid: latlon(20.1520249551217,-155.794115948999)],modifier: none,echelon: company,speechPoid: idY8YR2RNTJ9KH2KGJMMUWPUZ7C,fsTYPE: tg,coding_scheme: tactical_graphics,tg_category: maneuver,overlay: operations,tg_maneuver: general,tg_maneuver_type: n_a,geometry: line,tg_maneuver_line: boundary,echelon_possible: yes,icon_class: military,affiliation: friend,order_battle: control_markings,spoken_language: 'company boundary',auth: [fsTYPE: auth,source: 'SdkCommandSample_677c31b4-c1ec-4bbb-a8e4-b240403715ca',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '677c31b4-c1ec-4bbb-a8e4-b240403715ca'],ui_status: confirming,speech: 'company boundary',interval: interval(timeval(1691678782,857),timeval(1691678784,465)),confidence: 0.768408744159612,status: present,tg_maneuver_geometry: line,symbol_id: 'GFGPGLB----E---',complete_language: 'PRESENT FRIENDLY COMPANY BOUNDARY',placed: true,poid: id13C6KT9SRD2ALMFP0NNB3FXEQ6,glyphPoid: id13C6KT9SRD2ALMFP0NNB3FXEQ6,alt: 0,fsdb_version: vNPSX126HH3UHDQ1G4LBTDP32G,fsdb_timestamp: '638272755885931006']
                    [location: [fsTYPE: line,coords: [latlon(20.212041995998,-155.84576255127),latlon(20.173536596266,-155.846449196777),latlon(20.1596787693624,-155.848680794678),latlon(20.1546832043903,-155.851084053955)],shape: line,candidate_poids: [],geo_bounds: [latlon(20.2252508598262,-155.9151137475586),latlon(20.025065064308414,-155.5093062524414)],pixel_bounds: [0,0,2364,1242],centroid: latlon(20.1830651103715,-155.846818825247)],fsTYPE: tg,coding_scheme: tactical_graphics,tg_category: maneuver,overlay: operations,echelon: none,tg_maneuver: general,tg_maneuver_type: n_a,tg_maneuver_geometry: line,geometry: line,tg_maneuver_line: phase_line,abbr: pl,designator1: 'BLUE',speechPoid: id6NJ8779E4R7927SG2F3W4CJKU,icon_class: military,affiliation: friend,order_battle: control_markings,modifier: none,spoken_language: 'phase line blue',auth: [fsTYPE: auth,source: 'SdkCommandSample_677c31b4-c1ec-4bbb-a8e4-b240403715ca',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '677c31b4-c1ec-4bbb-a8e4-b240403715ca'],ui_status: confirming,speech: 'phase line blue',interval: interval(timeval(1691678790,43),timeval(1691678791,862)),confidence: 0.853456478914844,status: present,symbol_id: 'GFGPGLP--------',complete_language: 'PRESENT FRIENDLY PHASE LINE BLUE',placed: true,poid: id59CS1442RQV46XVN5E55KXW5B,glyphPoid: id59CS1442RQV46XVN5E55KXW5B,alt: 0,fsdb_version: v176AR2KP3511P1PWXR9Q07FA94,fsdb_timestamp: '638272755955336278']
                    [location: [fsTYPE: line,coords: [latlon(20.219451984545,-155.782591164551),latlon(20.2142972472603,-155.786711037598),latlon(20.2049538507024,-155.789285958252),latlon(20.1812706619565,-155.788770974121),latlon(20.1698305538466,-155.785337746582),latlon(20.127607685216,-155.766969979248),latlon(20.1155188853257,-155.762850106201),latlon(20.1060083728424,-155.761820137939)],shape: line,candidate_poids: [],geo_bounds: [latlon(20.2252508598262,-155.9151137475586),latlon(20.025065064308414,-155.5093062524414)],pixel_bounds: [0,0,2364,1242],centroid: latlon(20.1628682238729,-155.778898983389)],fsTYPE: tg,coding_scheme: tactical_graphics,tg_category: maneuver,overlay: operations,echelon: none,tg_maneuver: general,tg_maneuver_type: n_a,tg_maneuver_geometry: line,geometry: line,tg_maneuver_line: flot,abbr: flot,speechPoid: id1CKFREJZ6YCBGCR5GNY9BHWUAC,icon_class: military,affiliation: friend,order_battle: control_markings,modifier: none,spoken_language: flot,auth: [fsTYPE: auth,source: 'SdkCommandSample_677c31b4-c1ec-4bbb-a8e4-b240403715ca',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '677c31b4-c1ec-4bbb-a8e4-b240403715ca'],ui_status: confirming,speech: flot,interval: interval(timeval(1691678799,838),timeval(1691678801,185)),confidence: 0.51451143059291,status: present,symbol_id: 'GFGPGLF--------',complete_language: 'PRESENT FRIENDLY FORWARD LINE OF OWN TROOPS',placed: true,poid: id14WDQQXQ9RCEG8S0KQ36J3ARKW,glyphPoid: id14WDQQXQ9RCEG8S0KQ36J3ARKW,alt: 0,fsdb_version: v14CEG6YA9YPB67Q1X9ZD57JTYV,fsdb_timestamp: '638272756054861672']
                    [confidence: 0.95,task_description: 'Attack OBJECTIVE WILDCATS along AXIS LOS ANGELES ',who: [fsTYPE: task_unit,symbol: poid(idFFZQLEXALV3ZL34HYJ19G3STS),unit_class: 'GroundManeuverUnitSymbol'],tgs: [[fsTYPE: task_tg,symbol: poid(id1KVXNT79YHWMBMDW9NWVAP0D26),tg_class: 'GroundAttackAxisOfAdvanceGraphicControlMeasureTG'],[fsTYPE: task_tg,symbol: poid(idGB9JUXWKE21LGRK8R1BU6R9Q9),tg_class: 'OffenseObjectiveAreaGraphicControlMeasureTG']],tgs_desired: [],creator_role: s3,fsTYPE: task,parent_coa: _x2d8,name: 'AssaultObjectiveOnAxis',how: 'ATTACK',what: 'NOT_SPECIFIED',prob: 0.90,usergroups: [[fsTYPE: usergroups,role: s3,affiliation: friend],[fsTYPE: usergroups,role: s2,affiliation: hostile]],trigger: 'GroundAttackAxisOfAdvanceGraphicControlMeasure',movement_features: [fsTYPE: movement_features,movement: true,moves_to: 'OffenseObjectiveAreaGraphicControlMeasure'],fires_features: [],tasksets: [mcwl14,adapx10],task_status: implicit,start_time: 0,end_time: 1,auth: [fsTYPE: auth,source: 'SdkCommandSample_677c31b4-c1ec-4bbb-a8e4-b240403715ca',identity: '004290052034260AA207',session: '004290052034260AA207',uuid: '677c31b4-c1ec-4bbb-a8e4-b240403715ca'],ui_status: confirming,speech: '',interval: interval(timeval(1691678736,883),timeval(1691678739,440)),poid: id4K18E8C5KRX03,glyphPoid: id4K18E8C5KRX03,alt: 0,fsdb_version: vGW9GAKVMSG9T1TX9ANHXAEM7U,fsdb_timestamp: '638272755794491689']
                    ])`;
            }
                // TODO: retrieve content from persistent storage instead of 'content' variable
                // TODO: display some sort of progress indicator/wait cursor
                await stpsdk.syncScenarioSession(content, 90);
                log("Synched scenario with session");
            // }
            // else {
            //     log("No scenario data to sync - Save first");
            // }
        } catch (error) {
            log(error, 'Error');
        }
    };

    // TO/ORBAT actions
    // Get content of the last loaded TO into a variable, ready to persist
    const buttonGetTO = document.getElementById('getto');
    buttonGetTO.onclick = async () => {
        // Get TO content back, ready to persist
        try {
            if (toPoid) {
                // TODO: display some sort of progress indicator/wait cursor
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
                    [fsTYPE: task_org_unit, name: 'A/2-69', designator1: 'A', unit_parent: '2-69', symbol_id: 'SFGPUCIZ---E---', parent_poid: poid(idR47DS5VCGL9ZE), affiliation: friend, echelon: company, poid: 'uuid7e99345a-f15a-4939-b963-0b83b1ec40f0'],
                    [fsTYPE: task_org_unit, name: 'PINEAPPLES | [ROYAL] PINEAPPLES', designator1: '1', unit_parent: 'A/2-69', symbol_id: 'SFGPUCIZ---D---', parent_poid: poid(idR47DS5VCGL9ZE), affiliation: friend, echelon: platoon, poid: 'uuid5336c5d5-9182-4846-bdd8-5c517869c274'],
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
                    [fsTYPE: task_org_unit, name: 'B/1-1', designator1: 'B', unit_parent: '1-1', symbol_id: 'SHGPUCIZ---E---', parent_poid: poid(idR47DS5VCGL8AB), affiliation: hostile, echelon: company, poid: uuid7e99345a-f15a-4939-b963-0b83b1ec51a2],
                    [fsTYPE: task_org_unit, name: '1/B/1-1', designator1: '1', unit_parent: 'B/1-1', symbol_id: 'SHGPUCIZ---D---', parent_poid: poid(idR47DS5VCGL8AB), affiliation: hostile, echelon: platoon, poid: uuid5336c5d5-9182-4846-bdd8-5c517869d342],
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

    // Role actions
    let currentRole = undefined;
    const roleRadioButtons = document.querySelectorAll("input[type='radio'][name=role]");
    for (rb in roleRadioButtons) {
        roleRadioButtons[rb].onchange = async () => {
            try {
                currentRoleBtn = document.querySelector("input[type='radio'][name=role]:checked");
                if (currentRoleBtn?.value) {
                    // Remove the user selection, waiting for STP's switch notification
                    currentRoleBtn.checked = false;
                    // TODO: display some sort of progress indicator/wait cursor
                    log("Requesting role switch to " + currentRoleBtn.value);
                    await stpsdk.setCurrentRole(currentRoleBtn.value);
                }
                else {
                    log("No role selected");
                }
            } catch (error) {
                log(error, 'Error');
            }
        };
    }

    // Connection to STP and app launch
    const buttonConnect = document.getElementById('connect');
    buttonConnect.onclick = async () => {
    try {
// Retrieve the session - if empty, defaults are applied by STP - 
            const sessionBox = document.getElementById('sessionId');
            let session = sessionBox.value;
        // TODO: display some sort of progress indicator/wait cursor
        // Connect and display the assigned session id on the UI
            sessionBox.value = await stpsdk.connect(appName, 30, machineId, session);
            // Load map and start edit session
            runApp(appName);
    } catch (error) {
        let msg = "Failed to connect to STP at " + webSocketUrl + ". \nSymbols will not be recognized. Please reload to try again";
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
                    {
                        selector: '#delButton', 
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

}

async function runApp(appName) {
    // Load the map
    map.load();

    // Join scenario if there is an active one already
    if (! await stpsdk.hasActiveScenario()) {
            // Start a new scenario
log("STP session has no active scenario - creating new");
    await stpsdk.createNewScenario(appName);
    log("New scenario created");
}
else {
        // Inform user that a scenario exists
        log("STP session has active scenario - Join or Sync to display content");
    }
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
            '<td>2525D PartA</td><td>' + symbol.symbol_id?.partA + '</td>' +
        '</tr>' +
        '<tr>' +
            '<td>2525D PartB</td><td>' + symbol.symbol_id?.partB + '</td>' +
        '</tr>' +
        '<tr>' +
            '<td>Symbol Set</td><td>' + symbol.symbol_id?.symbolSet + '</td>' +
        '</tr>' +
        '<tr>' +
            '<td>2525C SIDC</td><td>' + symbol.symbol_id?.legacy + '</td>' +
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
