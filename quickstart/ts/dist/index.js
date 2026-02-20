(function (SpeechSDK) {
    'use strict';

    function _interopNamespaceDefault(e) {
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n.default = e;
        return Object.freeze(n);
    }

    var SpeechSDK__namespace = /*#__PURE__*/_interopNamespaceDefault(SpeechSDK);

    function rewind(gj, outer) {
        let type = gj && gj.type, i;
        if (type === 'FeatureCollection') {
            let fc = gj;
            for (i = 0; i < fc.features.length; i++)
                rewind(fc.features[i], outer);
        }
        else if (type === 'GeometryCollection') {
            let gc = gj;
            for (i = 0; i < gc.geometries.length; i++)
                rewind(gc.geometries[i], outer);
        }
        else if (type === 'Feature') {
            let ft = gj;
            rewind(ft.geometry, outer);
        }
        else if (type === 'Polygon') {
            let pl = gj;
            rewindRings(pl.coordinates, outer);
        }
        else if (type === 'MultiPolygon') {
            let mp = gj;
            for (i = 0; i < mp.coordinates.length; i++)
                rewindRings(mp.coordinates[i], outer);
        }
        return gj;
    }
    function rewindRings(rings, outer) {
        if (rings.length === 0)
            return;
        rewindRing(rings[0], outer);
        for (let i = 1; i < rings.length; i++) {
            rewindRing(rings[i], !outer);
        }
    }
    function rewindRing(ring, dir) {
        let area = 0;
        for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
            area += (ring[i][0] - ring[j][0]) * (ring[j][1] + ring[i][1]);
        }
        if (area >= 0 !== !!dir)
            ring.reverse();
    }

    var StpMessageLevel;
    (function (StpMessageLevel) {
        StpMessageLevel["Error"] = "Error";
        StpMessageLevel["Warning"] = "Warning";
        StpMessageLevel["Info"] = "Info";
        StpMessageLevel["Debug"] = "Debug";
    })(StpMessageLevel || (StpMessageLevel = {}));
    var StpRole;
    (function (StpRole) {
        StpRole["s2"] = "S2";
        StpRole["s3"] = "S3";
        StpRole["s4"] = "S4";
        StpRole["fso"] = "FSO";
        StpRole["eng"] = "ENG";
    })(StpRole || (StpRole = {}));
    class StpItem {
    }
    class StpSymbol extends StpItem {
        asGeoJSON() {
            if (this.location == undefined ||
                this.location.coords == undefined ||
                this.location?.coords.length == 0) {
                throw new Error('Coordinates are undefined or empty');
            }
            let geom;
            if (this.location?.fsTYPE === 'point') {
                geom = {
                    type: 'Point',
                    coordinates: [this.location.coords[0].lon, this.location.coords[0].lat]
                };
            }
            else if (this.location?.fsTYPE === 'line') {
                geom = {
                    type: 'LineString',
                    coordinates: this.location.coords.map((item) => [item.lon, item.lat])
                };
            }
            else if (this.location?.fsTYPE === 'area') {
                geom = {
                    type: 'Polygon',
                    coordinates: [this.location.coords.map((item) => [item.lon, item.lat])]
                };
                geom = rewind(geom, false);
            }
            else if (this.location?.fsTYPE === 'multipoint') {
                geom = {
                    type: 'MultiPoint',
                    coordinates: this.location.coords.map((item) => [item.lon, item.lat])
                };
            }
            else {
                throw new Error('Expected "point", "line", "area", or "multipoint" geometry type. Got: ' +
                    this.location?.fsTYPE);
            }
            let symbolGJ = {
                type: 'Feature',
                id: this.poid,
                geometry: geom,
                properties: {
                    symbol: this
                }
            };
            return symbolGJ;
        }
    }
    class StpTaskOrg {
    }
    class StpTaskOrgUnit extends StpSymbol {
    }
    class StpTaskOrgRelationship {
    }
    var CommandRelationship;
    (function (CommandRelationship) {
        CommandRelationship["None"] = "none";
        CommandRelationship["Organic"] = "organic";
        CommandRelationship["Attached"] = "attached";
        CommandRelationship["Assigned"] = "assigned";
        CommandRelationship["AdCon"] = "adcon";
        CommandRelationship["OpCon"] = "opcon";
        CommandRelationship["TaCon"] = "tacon";
        CommandRelationship["DirectSupport"] = "ds";
        CommandRelationship["Reinforcing"] = "r";
        CommandRelationship["GeneralSupportReinforcing"] = "gsr";
        CommandRelationship["GeneralSupport"] = "gs";
    })(CommandRelationship || (CommandRelationship = {}));
    class StpTask extends StpItem {
    }
    class StpCoa {
    }
    var TaskWhat;
    (function (TaskWhat) {
        TaskWhat["NotSpecified"] = "not_specified";
        TaskWhat["AdvisePolice"] = "advise_police";
        TaskWhat["Ambush"] = "ambush";
        TaskWhat["AssignResponsibility"] = "assign_responsibility";
        TaskWhat["Block"] = "block";
        TaskWhat["BombAttack"] = "bomb_attack";
        TaskWhat["Breach"] = "breach";
        TaskWhat["Bypass"] = "bypass";
        TaskWhat["Clear"] = "clear";
        TaskWhat["CoerciveRecruiting"] = "coercive_recruiting";
        TaskWhat["CollectCasualties"] = "collect_casualties";
        TaskWhat["CollectCivilians"] = "collect_civilians";
        TaskWhat["CollectPrisoners"] = "collect_prisoners";
        TaskWhat["ConductAmbush"] = "conduct_ambush";
        TaskWhat["ConductAviatonAmbush"] = "conduct_aviaton_ambush";
        TaskWhat["ConductBilat"] = "conduct_bilat";
        TaskWhat["ConductGroupEngagement"] = "conduct_group_engagement";
        TaskWhat["ConductRaid"] = "conduct_raid";
        TaskWhat["ConductTcpOperation"] = "conduct_tcp_operation";
        TaskWhat["ConstituteReserve"] = "constitute_reserve";
        TaskWhat["Convoy"] = "convoy";
        TaskWhat["Defeat"] = "defeat";
        TaskWhat["Delay"] = "delay";
        TaskWhat["DeliverLeafletPsyop"] = "deliver_leaflet_psyop";
        TaskWhat["Demonstrate"] = "demonstrate";
        TaskWhat["Destroy"] = "destroy";
        TaskWhat["Disrupt"] = "disrupt";
        TaskWhat["DistributeFood"] = "distribute_food";
        TaskWhat["Emplace"] = "emplace";
        TaskWhat["EquipPolice"] = "equip_police";
        TaskWhat["EscortConvoy"] = "escort_convoy";
        TaskWhat["EvacuateCasualties"] = "evacuate_casualties";
        TaskWhat["EvacuateCivilians"] = "evacuate_civilians";
        TaskWhat["EvacuatePrisoners"] = "evacuate_prisoners";
        TaskWhat["Fix"] = "fix";
        TaskWhat["Follow"] = "follow";
        TaskWhat["FollowAndAssume"] = "follow_and_assume";
        TaskWhat["FollowAndSupport"] = "follow_and_support";
        TaskWhat["Halt"] = "halt";
        TaskWhat["HarrassmentFires"] = "harrassment_fires";
        TaskWhat["HouseToHousePsyop"] = "house_to_house_psyop";
        TaskWhat["IedAttack"] = "ied_attack";
        TaskWhat["Limit"] = "limit";
        TaskWhat["Looting"] = "looting";
        TaskWhat["MaintainHide"] = "maintain_hide";
        TaskWhat["MaintainOutpost"] = "maintain_outpost";
        TaskWhat["Move"] = "move";
        TaskWhat["Neutralize"] = "neutralize";
        TaskWhat["Observe"] = "observe";
        TaskWhat["Occupy"] = "occupy";
        TaskWhat["Patrol"] = "patrol";
        TaskWhat["Penetrate"] = "penetrate";
        TaskWhat["PositionSniper"] = "position_sniper";
        TaskWhat["PriorityOfFires"] = "priority_of_fires";
        TaskWhat["ProvideMedicalServices"] = "provide_medical_services";
        TaskWhat["ProvideService"] = "provide_service";
        TaskWhat["Receive"] = "receive";
        TaskWhat["Reconstruction"] = "reconstruction";
        TaskWhat["RecruitPolice"] = "recruit_police";
        TaskWhat["Refuel"] = "refuel";
        TaskWhat["RegulateTraffic"] = "regulate_traffic";
        TaskWhat["Reinforce"] = "reinforce";
        TaskWhat["Release"] = "release";
        TaskWhat["Resupply"] = "resupply";
        TaskWhat["Retain"] = "retain";
        TaskWhat["Rioting"] = "rioting";
        TaskWhat["Secure"] = "secure";
        TaskWhat["SeekRefuge"] = "seek_refuge";
        TaskWhat["Seize"] = "seize";
        TaskWhat["SniperAttack"] = "sniper_attack";
        TaskWhat["Supply"] = "supply";
        TaskWhat["SupplyMunitions"] = "supply_munitions";
        TaskWhat["TrainPolice"] = "train_police";
        TaskWhat["TransferMunitions"] = "transfer_munitions";
        TaskWhat["TrashRemoval"] = "trash_removal";
        TaskWhat["Turn"] = "turn";
        TaskWhat["TvRadioPsyop"] = "tv_radio_psyop";
        TaskWhat["WaterDelivery"] = "water_delivery";
        TaskWhat["WillfulRecruiting"] = "willful_recruiting";
    })(TaskWhat || (TaskWhat = {}));
    var TaskHow;
    (function (TaskHow) {
        TaskHow["NotSpecified"] = "not_specified";
        TaskHow["AirAssault"] = "air_assault";
        TaskHow["AirReconnaissance"] = "air_reconnaissance";
        TaskHow["AreaDefense"] = "area_defense";
        TaskHow["Assault"] = "assault";
        TaskHow["Attack"] = "attack";
        TaskHow["AttackInZone"] = "attack_in_zone";
        TaskHow["AttackByFire"] = "attack_by_fire";
        TaskHow["CerpFunding"] = "cerp_funding";
        TaskHow["Civilian"] = "civilian";
        TaskHow["Contracting"] = "contracting";
        TaskHow["CordonAndSearch"] = "cordon_and_search";
        TaskHow["Counterattack"] = "counterattack";
        TaskHow["CounterattackByFire"] = "counterattack_by_fire";
        TaskHow["Cover"] = "cover";
        TaskHow["Defend"] = "defend";
        TaskHow["DeliverServices"] = "deliver_services";
        TaskHow["Guard"] = "guard";
        TaskHow["InformationOperations"] = "information_operations";
        TaskHow["Insurgent"] = "insurgent";
        TaskHow["MobileDefense"] = "mobile_defense";
        TaskHow["MovingScreen"] = "moving_screen";
        TaskHow["NgoOperation"] = "ngo_operation";
        TaskHow["PassageOfLines"] = "passage_of_lines";
        TaskHow["Screen"] = "screen";
        TaskHow["SearchAndAttack"] = "search_and_attack";
        TaskHow["Security"] = "security";
        TaskHow["SecurityForceAssistance"] = "security_force_assistance";
        TaskHow["SupportByFire"] = "support_by_fire";
        TaskHow["Withdrawal"] = "withdrawal";
    })(TaskHow || (TaskHow = {}));
    var TaskWhy;
    (function (TaskWhy) {
        TaskWhy["Unknown"] = "unknown";
        TaskWhy["Allow"] = "allow";
        TaskWhy["Cause"] = "cause";
        TaskWhy["Create"] = "create";
        TaskWhy["Deceive"] = "deceive";
        TaskWhy["Deny"] = "deny";
        TaskWhy["Divert"] = "divert";
        TaskWhy["Enable"] = "enable";
        TaskWhy["Envelop"] = "envelop";
        TaskWhy["Influence"] = "influence";
        TaskWhy["Open"] = "open";
        TaskWhy["Prevent"] = "prevent";
        TaskWhy["Protect"] = "protect";
        TaskWhy["Support"] = "support";
        TaskWhy["Surprise"] = "surprise";
    })(TaskWhy || (TaskWhy = {}));
    var TaskROE;
    (function (TaskROE) {
        TaskROE["NotSpecified"] = "not_specified";
        TaskROE["Hold"] = "hold";
        TaskROE["Tight"] = "tight";
        TaskROE["Free"] = "free";
    })(TaskROE || (TaskROE = {}));
    class LatLon {
        constructor(lat, lon) {
            this.lat = lat;
            this.lon = lon;
        }
        equals(rhs) {
            return this.lat == rhs.lat && this.lon == rhs.lon;
        }
    }
    class Size {
        constructor(width, height) {
            this.width = width;
            this.height = height;
        }
        equals(rhs) {
            return this.width == rhs.width && this.height == rhs.height;
        }
    }

    class StpC2SIMProxy {
        constructor(stpsdk, options) {
            this.stpsdk = stpsdk;
            this.options = options;
            stpsdk.onSymbolReport = (poid, symbol) => {
                if (this.onSymbolReport) {
                    this.onSymbolReport(poid, symbol);
                }
            };
        }
        async exportPlanDataToC2SIMServer(name, dataType, affiliation, coaPoids, timeout) {
            let content = await this.getC2SIMContent(name, dataType, affiliation, coaPoids, timeout);
            if (content) {
                await this.pushC2SIMContent(content, dataType, timeout);
            }
        }
        async importInitializationFromC2SIMServer(timeout) {
            let content = await this.pullC2SIMInitialization(timeout);
            let stpContent = await this.convertC2SIMContent(content, timeout);
            await this.stpsdk.syncScenarioSession(stpContent, timeout);
        }
        async getC2SIMContent(name, dataType, affiliation, coaPoids, timeout) {
            return this.stpsdk.requestStp('GetC2SIMContent', {
                name: arguments[0],
                dataType: arguments[1],
                affiliation: arguments[2],
                coaPoids: arguments[3],
                options: this.options
            }, timeout);
        }
        async pushC2SIMContent(content, dataType, timeout) {
            return this.stpsdk.requestStp('PushC2SIMContent', {
                content: arguments[0],
                dataType: arguments[1],
                options: this.options
            }, timeout);
        }
        async pullC2SIMInitialization(timeout) {
            return this.stpsdk.requestStp('PullC2SIMInitialization', {
                options: this.options
            }, timeout);
        }
        async convertC2SIMContent(content, timeout) {
            return this.stpsdk.requestStp('ConvertC2SIMContent', {
                content: arguments[0],
                options: this.options
            }, timeout);
        }
    }

    class StpRecognizer {
        constructor(stpConnector) {
            this.stpConnector = stpConnector;
            this.serviceName = '';
        }
        async connect(serviceName, timeout, machineId, sessionId) {
            this.serviceName = serviceName;
            this.stpConnector.onInform = this.onInform.bind(this);
            this.stpConnector.onRequest = this.onRequest.bind(this);
            this.stpConnector.onError = this.onError.bind(this);
            try {
                let solvables = this.buildSolvables();
                return this.stpConnector.connect(this.serviceName, solvables, timeout, machineId, sessionId);
            }
            catch (e) {
                throw e;
            }
        }
        buildSolvables() {
            return Object.getOwnPropertyNames(this)
                .filter((name) => name.toString().startsWith('on') &&
                typeof this[name] == 'function')
                .map((name) => name.substring(2));
        }
        onInform(message) {
            let msg = JSON.parse(message);
            this.handleInform(msg);
        }
        onRequest(message) {
            this.onInform(message);
            return [];
        }
        onError(error) {
            if (this.onStpMessage) {
                this.onStpMessage(error, StpMessageLevel.Error);
            }
        }
        handleInform(msg) {
            if (msg.method === 'SymbolAdded' && this.onSymbolAdded) {
                const pp = msg.params;
                let alts = [];
                for (let i = 0; i < pp.alternates.length; i++) {
                    const symbol = Object.assign(new StpSymbol(), pp.alternates[i]);
                    alts.push(symbol);
                }
                this.onSymbolAdded(alts, pp.isUndo);
            }
            else if (msg.method === 'SymbolModified' && this.onSymbolModified) {
                const pp = msg.params;
                const symbol = Object.assign(new StpSymbol(), pp.symbol);
                this.onSymbolModified(pp.poid, symbol, pp.isUndo);
            }
            else if (msg.method === 'SymbolDeleted' && this.onSymbolDeleted) {
                const pp = msg.params;
                this.onSymbolDeleted(pp.poid, pp.isUndo);
            }
            else if (msg.method === 'SymbolReport' && this.onSymbolReport) {
                const pp = msg.params;
                const symbol = Object.assign(new StpSymbol(), pp.symbol);
                this.onSymbolReport(pp.poid, symbol);
            }
            else if (msg.method === 'TaskOrgAdded' && this.onTaskOrgAdded || msg.method === 'TaskOrgModified' && this.onTaskOrgModified) {
                const pp = msg.params;
                const taskOrg = Object.assign(new StpTaskOrg(), pp.taskOrg);
                if (msg.method === 'TaskOrgAdded' && this.onTaskOrgAdded) {
                    this.onTaskOrgAdded(taskOrg, pp.isUndo);
                }
                else if (msg.method === 'TaskOrgModified' && this.onTaskOrgModified) {
                    this.onTaskOrgModified(pp.poid, taskOrg, pp.isUndo);
                }
            }
            else if (msg.method === 'TaskOrgDeleted' && this.onTaskOrgDeleted) {
                const pp = msg.params;
                this.onTaskOrgDeleted(pp.poid, pp.isUndo);
            }
            else if (msg.method === 'TaskOrgUnitAdded' && this.onTaskOrgUnitAdded || msg.method === 'TaskOrgUnitModified' && this.onTaskOrgUnitModified) {
                const pp = msg.params;
                const unit = Object.assign(new StpTaskOrgUnit(), pp.toUnit);
                if (msg.method === 'TaskOrgUnitAdded' && this.onTaskOrgUnitAdded) {
                    this.onTaskOrgUnitAdded(unit, pp.isUndo);
                }
                else if (msg.method === 'TaskOrgUnitModified' && this.onTaskOrgUnitModified) {
                    this.onTaskOrgUnitModified(pp.poid, unit, pp.isUndo);
                }
            }
            else if (msg.method === 'TaskOrgUnitDeleted' && this.onTaskOrgUnitDeleted) {
                const pp = msg.params;
                this.onTaskOrgUnitDeleted(pp.poid, pp.isUndo);
            }
            else if (msg.method === 'TaskOrgRelationshipAdded' && this.onTaskOrgRelationshipAdded || msg.method === 'TaskOrgRelationshipModified' && this.onTaskOrgRelationshipModified) {
                const pp = msg.params;
                const unit = Object.assign(new StpTaskOrgRelationship(), pp.toRelationship);
                if (msg.method === 'TaskOrgRelationshipAdded' && this.onTaskOrgRelationshipAdded) {
                    this.onTaskOrgRelationshipAdded(unit, pp.isUndo);
                }
                else if (msg.method === 'TaskOrgRelationshipModified' && this.onTaskOrgRelationshipModified) {
                    this.onTaskOrgRelationshipModified(pp.poid, unit, pp.isUndo);
                }
            }
            else if (msg.method === 'TaskOrgRelationshipDeleted' && this.onTaskOrgRelationshipDeleted) {
                const pp = msg.params;
                this.onTaskOrgRelationshipDeleted(pp.poid, pp.isUndo);
            }
            else if (msg.method === 'TaskAdded' && this.onTaskAdded || msg.method === 'TaskModified' && this.onTaskModified) {
                const pp = msg.params;
                let alts = [];
                for (let i = 0; i < pp.alternates.length; i++) {
                    const task = Object.assign(new StpTask(), pp.alternates[i]);
                    alts.push(task);
                }
                if (msg.method === 'TaskAdded' && this.onTaskAdded) {
                    this.onTaskAdded(pp.poid, alts, pp.taskPoids, pp.isUndo);
                }
                else if (msg.method === 'TaskModified' && this.onTaskModified) {
                    this.onTaskModified(pp.poid, alts, pp.taskPoids, pp.isUndo);
                }
            }
            else if (msg.method === 'TaskDeleted' && this.onTaskDeleted) {
                const pp = msg.params;
                this.onTaskDeleted(pp.poid, pp.isUndo);
            }
            else if (msg.method === 'TaskOrgSwitched' && this.onTaskOrgSwitched) {
                const pp = msg.params;
                this.onTaskOrgSwitched(pp.taskOrg);
            }
            else if (msg.method === 'CoaAdded' && this.onCoaAdded || msg.method === 'CoaModified' && this.onCoaModified) {
                const pp = msg.params;
                const unit = Object.assign(new StpCoa(), pp.coa);
                if (msg.method === 'CoaAdded' && this.onCoaAdded) {
                    this.onCoaAdded(pp.poid, pp.coa, pp.isUndo);
                }
                else if (msg.method === 'CoaModified' && this.onCoaModified) {
                    this.onCoaModified(pp.poid, unit, pp.isUndo);
                }
            }
            else if (msg.method === 'CoaDeleted' && this.onCoaDeleted) {
                const pp = msg.params;
                this.onCoaDeleted(pp.poid, pp.isUndo);
            }
            else if (msg.method === 'RoleSwitched' && this.onRoleSwitched) {
                const pp = msg.params;
                this.onRoleSwitched(pp.role);
            }
            else if (msg.method === 'InkProcessed' && this.onInkProcessed) {
                this.onInkProcessed();
            }
            else if (msg.method === 'SpeechRecognized' && this.onSpeechRecognized) {
                const pp = msg.params;
                this.onSpeechRecognized(pp.phrases);
            }
            else if (msg.method === 'SymbolEdited' && this.onSymbolEdited) {
                const pp = msg.params;
                this.onSymbolEdited(pp.operation, pp.location);
            }
            else if (msg.method === 'MapOperation' && this.onMapOperation) {
                const pp = msg.params;
                this.onMapOperation(pp.operation, pp.location);
            }
            else if (msg.method === 'Command' && this.onCommand) {
                const pp = msg.params;
                this.onCommand(pp.operation, pp.location);
            }
            else if (msg.method === 'StpMessage' && this.onStpMessage) {
                const pp = msg.params;
                this.onStpMessage(pp.message, pp.level);
            }
            else {
                console.log('Received message with no handler: ' + msg.method);
            }
        }
        informStp(name, parms) {
            try {
                let msg = {
                    method: name,
                    params: parms
                };
                this.stpConnector.inform(JSON.stringify(msg));
            }
            catch (e) {
                if (this.onStpMessage) {
                    this.onStpMessage(e.message, StpMessageLevel.Error);
                }
            }
        }
        async requestStp(name, parms, timeout) {
            try {
                let msg = {
                    method: name,
                    params: parms
                };
                return this.stpConnector.request(JSON.stringify(msg), timeout);
            }
            catch (e) {
                if (this.onStpMessage) {
                    this.onStpMessage(e.message, StpMessageLevel.Error);
                }
            }
        }
        sendPenDown(location, timestamp) {
            this.informStp('SendPenDown', {
                location: arguments[0],
                timestamp: arguments[1]
            });
        }
        sendInk(pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids) {
            this.informStp('SendInk', {
                pixelBoundsWindow: arguments[0],
                topLeftGeoMap: arguments[1],
                bottomRightGeoMap: arguments[2],
                strokePoints: arguments[3],
                timeStrokeStart: arguments[4],
                timeStrokeEnd: arguments[5],
                intersectedPoids: arguments[6]
            });
        }
        sendSpeechRecognition(recoList, startTime, endTime) {
            this.informStp('SendSpeechRecognition', {
                recoList: arguments[0],
                startTime: arguments[1],
                endTime: arguments[2]
            });
        }
        async createNewScenario(name, timeout) {
            return this.requestStp('CreateNewScenario', {
                name: arguments[0],
            }, timeout);
        }
        async loadNewScenario(content, timeout) {
            return this.requestStp('LoadNewScenario', {
                content: arguments[0],
            }, timeout);
        }
        async importPlanData(content, timeout) {
            return this.requestStp('ImportPlanData', {
                content: arguments[0],
            }, timeout);
        }
        async getScenarioContent(timeout) {
            return this.requestStp('GetScenarioContent', null, timeout);
        }
        async joinScenarioSession(timeout) {
            return this.requestStp('JoinScenarioSession', null, timeout);
        }
        async syncScenarioSession(content, timeout) {
            return this.requestStp('SyncScenarioSession', {
                content: arguments[0],
            }, timeout);
        }
        async hasActiveScenario(timeout) {
            return this.requestStp('HasActiveScenario', null, timeout);
        }
        createC2SIMProxy(options) {
            return new StpC2SIMProxy(this, options);
        }
        addSymbol(symbol) {
            this.informStp('AddSymbol', {
                symbol: arguments[0]
            });
        }
        updateSymbol(poid, symbol) {
            this.informStp('UpdateSymbol', {
                poid: arguments[0],
                symbol: arguments[1]
            });
        }
        deleteSymbol(poid) {
            this.informStp('DeleteSymbol', {
                poid: arguments[0]
            });
        }
        chooseAlternate(poid, nBestIndex) {
            this.informStp('ChooseAlternate', {
                poid: arguments[0],
                nBestIndex: arguments[1]
            });
        }
        async importTaskOrgContent(content, timeout) {
            return this.requestStp('ImportTaskOrgContent', {
                content: arguments[0],
            }, timeout);
        }
        async getTaskOrgContent(poid, timeout) {
            return this.requestStp('GetTaskOrgContent', {
                poid: arguments[0],
            }, timeout);
        }
        async setDefaultTaskOrg(poid, timeout) {
            return this.requestStp('SetDefaultTaskOrg', {
                poid: arguments[0],
            }, timeout);
        }
        async resetDefaultTaskOrg(affiliation, timeout) {
            return this.requestStp('ResetDefaultTaskOrg', {
                affiliation: arguments[0],
            }, timeout);
        }
        addTaskOrg(taskOrg) {
            this.informStp('AddTaskOrg', {
                taskOrg: arguments[0],
            });
        }
        updateTaskOrg(poid, taskOrg) {
            this.informStp('UpdateTaskOrg', {
                poid: arguments[0],
                taskOrg: arguments[1],
            });
        }
        deleteTaskOrg(poid) {
            this.informStp('DeleteTaskOrg', {
                poid: arguments[0],
            });
        }
        addTaskOrgUnit(toUnit) {
            this.informStp('AddTaskOrgUnit', {
                toUnit: arguments[0]
            });
        }
        updateTaskOrgUnit(poid, toUnit) {
            this.informStp('UpdateTaskOrgUnit', {
                poid: arguments[0],
                toUnit: arguments[1]
            });
        }
        deleteTaskOrgUnit(poid) {
            this.informStp('DeleteTaskOrgUnit', {
                poid: arguments[0]
            });
        }
        addTaskOrgRelationship(toUnit) {
            this.informStp('AddTaskOrgRelationship', {
                toRelationship: arguments[0]
            });
        }
        updateTaskOrgRelationship(poid, toUnit) {
            this.informStp('UpdateTaskOrgRelationship', {
                poid: arguments[0],
                toRelationship: arguments[1]
            });
        }
        deleteTaskOrgRelationship(poid) {
            this.informStp('DeleteTaskOrgRelationship', {
                poid: arguments[0]
            });
        }
        addTask(task) {
            this.informStp('AddTask', {
                task: arguments[0]
            });
        }
        updateTask(poid, alternates) {
            this.informStp('UpdateTask', {
                poid: arguments[0],
                alternates: arguments[1]
            });
        }
        deleteTask(poid) {
            this.informStp('DeleteTask', {
                poid: arguments[0]
            });
        }
        confirmTask(poid, nBestIndex, isConfirmed = true) {
            this.informStp('ConfirmTask', {
                poid: arguments[0],
                nBestIndex: arguments[1],
                isConfirmed: arguments[2]
            });
        }
        async setCoaTaskOrg(toPoid, coaPoid, timeout) {
            return this.requestStp('SetCoaTaskOrg', {
                toPoid: arguments[0],
                coaPoid: arguments[1],
            }, timeout);
        }
        async resetCoaTaskOrg(coaPoid, timeout) {
            return this.requestStp('SetCoaTaskOrg', {
                affiliation: arguments[0],
                coaPoid: arguments[1],
            }, timeout);
        }
        async importCoaContent(toContent, timeout) {
            return this.requestStp('ImportCoaContent', {
                content: arguments[0],
            }, timeout);
        }
        async getCoaContent(poid, timeout) {
            return this.requestStp('GetCoaContent', {
                poid: arguments[0],
            }, timeout);
        }
        async setCurrentCoa(poid, timeout) {
            return this.requestStp('SetCurrentCoa', {
                poid: arguments[0],
            }, timeout);
        }
        addCoa(coa) {
            this.informStp('AddCoa', {
                coa: arguments[0],
            });
        }
        updateCoa(poid, coa) {
            this.informStp('UpdateCoa', {
                poid: arguments[0],
                coa: arguments[1],
            });
        }
        deleteCoa(poid) {
            this.informStp('DeleteCoa', {
                poid: arguments[0],
            });
        }
        async setCurrentRole(role, createIfNone = true, timeout) {
            return this.requestStp('SetRole', {
                role: arguments[0],
            }, timeout);
        }
        promiseWithTimeout(timeout, promise) {
            return Promise.race([
                promise,
                new Promise((resolve, reject) => {
                    let id = setTimeout(() => {
                        clearTimeout(id);
                        reject(new Error('Operation timed out'));
                    }, timeout * 1000);
                })
            ]);
        }
    }

    class StpWebSocketsConnector {
        get isConnected() {
            return this.socket != null && this.socket.readyState === this.socket.OPEN;
        }
        get isConnecting() {
            return (this.socket != null && this.socket.readyState === this.socket.CONNECTING);
        }
        get connState() {
            return this.socket ? this.socket.readyState.toString() : '';
        }
        constructor(connstring) {
            this.DEFAULT_TIMEOUT = 30;
            this.connstring = connstring;
            this.socket = null;
        }
        async connect(serviceName, solvables, timeout = this.DEFAULT_TIMEOUT, machineId = null, sessionId = null) {
            return new Promise(async (resolve, reject) => {
                if (this.isConnected) {
                    resolve(this.sessionId);
                }
                this.serviceName = serviceName;
                this.solvables = solvables;
                if (machineId != null) {
                    this.machineId = machineId;
                }
                if (sessionId != null) {
                    this.sessionId = sessionId;
                }
                if (timeout <= 0) {
                    timeout = this.DEFAULT_TIMEOUT;
                }
                try {
                    this.socket = await this.promiseWithTimeout(timeout, this.tryConnect(this.connstring));
                }
                catch (e) {
                    reject(new Error('Failed to connect: ' + e.message));
                    return;
                }
                this.socket.onmessage = (ev) => {
                    const msg = JSON.parse(ev.data);
                    if (msg.method === "RequestResponse") {
                        const params = msg.params;
                        let index = Tracker.trackedResponses.findIndex(t => t.cookie === params.cookie);
                        Tracker.trackedResponses.find(t => t.cookie === params.cookie);
                        if (index > -1) {
                            let tracker = Tracker.trackedResponses.splice(index, 1)[0];
                            if (params.success) {
                                tracker.responseFuture.resolve(params.result);
                            }
                            else {
                                tracker.responseFuture.reject(params.result);
                            }
                        }
                    }
                    else {
                        if (this.onInform)
                            this.onInform(ev.data);
                    }
                };
                this.socket.onerror = (ev) => {
                    if (this.onError) {
                        this.onError('Error connecting to STP. Check that the service is running and refresh page to retry');
                    }
                };
                this.socket.onclose = async (ev) => {
                    if (!this.isConnecting) {
                        try {
                            await this.connect(this.serviceName, this.solvables, this.timeout, this.machineId);
                        }
                        catch (error) {
                            if (this.onError) {
                                this.onError('Lost connection to STP. Check that the service is running and refresh page to retry');
                            }
                        }
                    }
                };
                try {
                    this.sessionId = await this.register(timeout);
                }
                catch (e) {
                    reject(new Error('Failed to register with STP: ' + e.message));
                    return;
                }
                resolve(this.sessionId);
            });
        }
        register(timeout = this.DEFAULT_TIMEOUT) {
            if (!this.isConnected) {
                throw new Error('Failed to register: connection is not open (' + this.connState + ')');
            }
            this.name = this.serviceName;
            let msg = {
                method: 'Register',
                params: {
                    serviceName: this.serviceName,
                    language: 'javascript',
                    solvables: this.solvables,
                    machineId: this.machineId || this.getUniqueId(9),
                    sessionId: this.sessionId
                }
            };
            return this.request(JSON.stringify(msg), timeout);
        }
        disconnect(timeout = this.DEFAULT_TIMEOUT) {
            return this.promiseWithTimeout(timeout, new Promise(async (resolve, reject) => {
                if (!this.isConnected && this.socket) {
                    this.socket.close();
                }
                resolve();
            }));
        }
        inform(message, timeout = this.DEFAULT_TIMEOUT) {
            if (!this.isConnected) {
                throw new Error('Failed to send inform: connection is not open (' + this.connState + ')');
            }
            return this.promiseWithTimeout(timeout, new Promise(async (resolve, reject) => {
                if (!this.socket) {
                    return;
                }
                this.socket.send(message);
                resolve();
            }));
        }
        async request(message, timeout = this.DEFAULT_TIMEOUT) {
            if (!this.isConnected || !this.socket) {
                throw new Error('Failed to send request: connection is not open (' + this.connState + ')');
            }
            let tracker = new Tracker();
            return this.promiseWithTimeout(timeout, new Promise(async (resolve, reject) => {
                if (!this.socket) {
                    return;
                }
                const requestMessage = {
                    method: "Request",
                    params: {
                        jsonRequest: message,
                        cookie: tracker.cookie,
                        timeout: timeout,
                    }
                };
                this.socket.send(JSON.stringify(requestMessage));
                tracker.responseFuture
                    .then((value) => resolve(value))
                    .catch((reason) => reject(reason));
            }));
        }
        tryConnect(connstring) {
            return new Promise((resolve, reject) => {
                var socket = new WebSocket(connstring);
                socket.onopen = () => resolve(socket);
                socket.onerror = (err) => reject(new Error('Unspecified error communicating with STP'));
            });
        }
        promiseWithTimeout(timeout, promise) {
            return Promise.race([
                promise,
                new Promise((resolve, reject) => {
                    let id = setTimeout(() => {
                        clearTimeout(id);
                        reject(new Error('Operation timed out'));
                    }, timeout * 1000);
                })
            ]);
        }
        getUniqueId(numChars) {
            if (!numChars)
                numChars = 9;
            return Math.random().toString(36).substr(2, numChars);
        }
    }
    class Tracker {
        constructor() {
            this.cookie = Tracker.lastCookie++;
            this.responseFuture = new Future();
            Tracker.trackedResponses.push(this);
        }
    }
    Tracker.lastCookie = 0;
    Tracker.trackedResponses = [];
    class Future {
        constructor(promise) {
            if (!(this instanceof Future)) {
                return new Future(promise);
            }
            this.promise = promise || new Promise(this.promiseExecutor.bind(this));
        }
        asPromise() {
            return this.promise;
        }
        then(onfulfilled, onrejected) {
            return new Future(this.promise.then(onfulfilled, onrejected));
        }
        catch(onrejected) {
            return new Future(this.promise.catch(onrejected));
        }
        resolve(value) {
            this.resolveFunction(value);
        }
        reject(reason) {
            this.rejectFunction(reason);
        }
        promiseExecutor(resolve, reject) {
            this.resolveFunction = resolve;
            this.rejectFunction = reject;
        }
    }

    class AzureSpeechRecognizer {
        constructor(speechSubscriptionKey, serviceRegion, endPoint, audioConfig, recoLanguage) {
            this.speechSubscriptionKey = speechSubscriptionKey;
            this.serviceRegion = serviceRegion;
            this.speechConfig = SpeechSDK__namespace.SpeechConfig.fromSubscription(this.speechSubscriptionKey, this.serviceRegion);
            this.speechConfig.speechRecognitionLanguage = recoLanguage ? recoLanguage : 'en-US';
            this.speechConfig.outputFormat = SpeechSDK__namespace.OutputFormat.Detailed;
            if (endPoint) {
                this.speechConfig.endpointId = endPoint;
            }
            this.audioConfig = audioConfig
                ? audioConfig
                : SpeechSDK__namespace.AudioConfig.fromDefaultMicrophoneInput();
            this.isListening = false;
        }
        setPhraseList(phrases) {
            this.phraseList = phrases;
        }
        initializeReco() {
            this.recognizer = new SpeechSDK__namespace.SpeechRecognizer(this.speechConfig, this.audioConfig);
            if (this.phraseList) {
                const phraseList = SpeechSDK__namespace.PhraseListGrammar.fromRecognizer(this.recognizer);
                phraseList.addPhrases(this.phraseList);
            }
        }
        recognizeOnce(maxRetries) {
            const delay = 250;
            if (!maxRetries) {
                maxRetries = 2000 / delay;
            }
            this.initializeReco();
            return new Promise(async (resolve, reject) => {
                for (let i = 0; i < maxRetries; i++) {
                    this.recoStart = new Date();
                    try {
                        const recoResult = await this.tryReco(this.recoStart);
                        resolve(recoResult);
                        return;
                    }
                    catch (e) {
                    }
                    if (i < maxRetries - 1) {
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                }
                let err = new Error('Failed to recognize speech');
                this.onError?.call(this, err);
                reject(err);
            });
        }
        tryReco(recoStart) {
            return new Promise((resolve, reject) => {
                this.recognizer.recognizing = (s, e) => {
                    this.onRecognizing?.call(this, e.result.text);
                };
                this.recognizer.recognized = (s, e) => {
                    let recoResult = this.convertResults(recoStart, e.result);
                    this.onRecognized?.call(this, recoResult);
                    resolve(recoResult);
                };
                this.recognizer.canceled = (s, e) => {
                    this.isListening = false;
                    reject(new Error(SpeechSDK__namespace.CancellationReason[e.reason]));
                };
                if (!this.isListening) {
                    this.isListening = true;
                    this.recognizer?.recognizeOnceAsync();
                    this.isListening = false;
                }
            });
        }
        startRecognizing() {
            if (this.isListening) {
                return;
            }
            this.initializeReco();
            this.recoStart = new Date();
            this.recognizer.recognizing = (s, e) => {
                this.onRecognizing?.call(this, e.result.text);
            };
            this.recognizer.recognized = (s, e) => {
                let recoResult = this.convertResults(this.recoStart, e.result);
                this.onRecognized?.call(this, recoResult);
            };
            this.recognizer.canceled = (s, e) => {
                this.isListening = false;
                let err = new Error(SpeechSDK__namespace.CancellationReason[e.reason]);
                if (this.onError) {
                    this.onError.call(this, err);
                }
                else {
                    this.onRecognized?.call(this, null);
                }
            };
            this.isListening = true;
            this.recognizer.startContinuousRecognitionAsync();
        }
        stopRecognizing(wait) {
            if (this.recognizer) {
                setTimeout(() => {
                    this.recognizer?.close();
                    this.recognizer = undefined;
                }, wait ? wait : 0);
            }
            this.isListening = false;
        }
        convertResults(recoStart, result) {
            if (result.reason === SpeechSDK__namespace.ResultReason.NoMatch) {
                return null;
            }
            let recoResult = new SpeechRecoResult();
            recoResult.startTime = this.addTicksToDate(recoStart, result.offset);
            recoResult.endTime = this.addTicksToDate(recoResult.startTime, result.duration);
            let jsonDetails = result.properties.getProperty(SpeechSDK__namespace.PropertyId.SpeechServiceResponse_JsonResult);
            let detailedProperties = Object.assign(new AzureSpeechDetailedResults(), JSON.parse(jsonDetails));
            const basicConversion = detailedProperties.NBest.map((item) => new SpeechRecoItem(item.Lexical, item.Confidence));
            let resultsArray = Array.from(basicConversion);
            for (let i = 0; i < basicConversion.length; i++) {
                const item = basicConversion[i];
                if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z]$/) >= 0) {
                    const acronym = item.text.replace(/\s/g, '');
                    const conf = item.confidence * 0.9;
                    resultsArray.push(new SpeechRecoItem(acronym, conf));
                }
                else if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z][a-zA-Z]+$/) >= 0) {
                    let parts = item.text.match(/^(([a-zA-Z]\s)+)([a-zA-Z][a-zA-Z]+)$/);
                    if (parts && parts.length == 4) {
                        const acronym = parts[1].replace(/\s/g, '');
                        const designator = parts[3];
                        const conf = item.confidence * 0.85;
                        resultsArray.push(new SpeechRecoItem(acronym + ' ' + designator, conf));
                    }
                }
            }
            recoResult.results = resultsArray.sort((a, b) => b.confidence - a.confidence);
            return recoResult;
        }
        addTicksToDate(date, ticksToAdd) {
            let dateTicks = date.getTime() * 10000 + 621355968000000000;
            let totalTicks = dateTicks + ticksToAdd;
            let jsMilli = (totalTicks - 621355968000000000) / 10000;
            let res = new Date(jsMilli);
            return res;
        }
    }
    class SpeechRecoResult {
        constructor() {
            this.results = [];
            this.startTime = new Date();
            this.endTime = new Date();
        }
    }
    class SpeechRecoItem {
        constructor(text, confidence) {
            this.text = text;
            this.confidence = confidence;
        }
    }
    class AzureSpeechDetailedResults {
        constructor() {
            this.RecognitionStatus = '';
            this.Offset = 0;
            this.Duration = 0;
            this.DisplayText = '';
            this.NBest = [];
        }
    }

    class BasicRenderer {
        constructor(symbol, pointSize = 50) {
            this.symbol = symbol;
            this.size = pointSize;
        }
        asGeoJSON() {
            let res = this.symbol.asGeoJSON();
            let gesture = this.getGestureGeometry(this.symbol);
            res.geometry = gesture;
            let svgRendering = this.asSVG();
            if (svgRendering) {
                res.properties.rendering = svgRendering;
            }
            return res;
        }
        asSVG() {
            if (this.symbol.location?.fsTYPE == 'point') {
                let gsvg = [this.pointSVG(this.symbol)];
                return gsvg;
            }
            else {
                return null;
            }
        }
        getGestureGeometry(symbol) {
            if (symbol.location == undefined || symbol.location == null || symbol.location.coords == undefined || symbol.location.coords.length == 0 || symbol.location.centroid == undefined) {
                throw new Error('Symbol does not have location information');
            }
            let res;
            if (symbol.location.shape == "point") {
                res = {
                    type: "Point",
                    coordinates: [symbol.location.centroid.lon, symbol.location.centroid.lat]
                };
            }
            else {
                res = this.toLineString(symbol.location.coords);
                if (symbol.location?.shape != null && symbol.location?.shape.includes("arrowfat")) {
                    let reorderedLatLon = symbol.location.coords.slice(0, symbol.location.coords.length - 1).reverse();
                    reorderedLatLon.push(symbol.location.coords[symbol.location.coords.length - 1]);
                    res = this.toLineString(reorderedLatLon);
                }
                else if (symbol.location?.shape == "ubend") {
                    let reorderedLatLon = [symbol.location.coords[0], symbol.location.coords[2], symbol.location.coords[3], symbol.location.coords[1]];
                    res = this.toLineString(reorderedLatLon);
                }
                else if (symbol.location?.shape == "ubendthreepoints") {
                    let fourthPt = new LatLon(symbol.location.coords[1].lat, symbol.location.coords[2].lon);
                    let reorderedLatLon = [symbol.location.coords[0], symbol.location.coords[2], fourthPt, symbol.location.coords[1]];
                    res = this.toLineString(reorderedLatLon);
                }
                else if (symbol.location?.shape == "vee") {
                    let reorderedLatLon = [symbol.location.coords[1], symbol.location.coords[0], symbol.location.coords[2]];
                    res = this.toLineString(reorderedLatLon);
                }
                else if (symbol.location?.shape == "opencircle") ;
                else if (symbol.location?.shape == "multipoint") {
                    res = {
                        type: "MultiPoint",
                        coordinates: symbol.location.coords.map((item) => [item.lon, item.lat])
                    };
                }
            }
            return res;
        }
        pointSVG(symbol) {
            if (symbol.location == undefined || symbol.location == null || symbol.location.centroid == undefined) {
                throw new Error('Point symbol does not have a defined centroid');
            }
            let command;
            let properties;
            let fillColor;
            let width;
            let height;
            let strokeColor = "black";
            let strokeWidth = 1;
            let rotation = 0;
            let transform = '';
            const scaling = 1.42;
            if (symbol.affiliation === "friend") {
                width = this.size - 2 * strokeWidth;
                height = this.size / scaling - 2 * strokeWidth;
                command = 'rect';
                properties = 'width="' + width + '" ' +
                    'height="' + height + '" ';
                fillColor = "#80e0ff";
            }
            else if (symbol.affiliation === "hostile") {
                let side = this.size / scaling - 2 * strokeWidth;
                width = height = side * Math.SQRT2;
                command = 'rect';
                properties = 'width="' + side + '" ' +
                    'height="' + side + '" ';
                fillColor = "#ff8080";
                rotation = 45;
                transform = 'transform="translate(' + width / 2 + ' 0) rotate(' + rotation + ')" ';
            }
            else if (symbol.affiliation === "neutral") {
                width = height = this.size / scaling - 2 * strokeWidth;
                command = 'rect';
                properties = 'width="' + width + '" ' +
                    'height="' + height + '" ';
                fillColor = "#aaffaa";
            }
            else {
                width = height = this.size / scaling - 2 * strokeWidth;
                command = 'circle';
                properties = 'cx="' + width / 2 + '" ' +
                    'cy="' + height / 2 + '" ' +
                    'r="' + width / 2 + '" ';
                fillColor = "#ffff80";
            }
            let svg = '<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" ' +
                'width="' + width + '" ' +
                'height="' + height + '" ' +
                'viewBox="0 0 ' + width + ' ' + height + '" ' +
                '> ' +
                '<' + command + ' ' + properties + ' ' +
                'stroke="' + strokeColor + '" ' +
                'stoke-width="' + strokeWidth + '" ' +
                'fill="' + fillColor + '" ' +
                transform +
                '/>' +
                '</svg>';
            let shape;
            if (rotation > 0) {
                const matrix = this.getTransform(svg, command);
                shape = [
                    this.applyTransform(matrix, { x: 0, y: 0 }),
                    this.applyTransform(matrix, { x: width, y: 0 }),
                    this.applyTransform(matrix, { x: width, y: height }),
                    this.applyTransform(matrix, { x: 0, y: height }),
                ];
            }
            else {
                shape = [
                    { x: 0, y: 0 },
                    { x: width, y: 0 },
                    { x: width, y: height },
                    { x: 0, y: height },
                ];
            }
            let res = {
                type: 'icon',
                title: symbol.description,
                topLeft: symbol.location.centroid,
                bottomRight: symbol.location.centroid,
                position: symbol.location.centroid,
                svg: btoa(svg),
                shape: shape,
                anchor: { x: width / 2, y: height / 2 }
            };
            return res;
        }
        getTransform(svg, selector) {
            let tempDiv = document.createElement('div');
            document.body.appendChild(tempDiv);
            tempDiv.setAttribute('style', "position:absolute; padding:0; margin:0;visibility:hidden; width:0; height:0");
            tempDiv.insertAdjacentHTML('beforeend', svg);
            let svgEl = tempDiv.querySelector(selector);
            let matrix = svgEl?.getCTM();
            document.body.removeChild(tempDiv);
            if (matrix) {
                return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
            }
            else {
                return [1, 0, 0, 1, 0, 0];
            }
        }
        toLineString(coords) {
            let res = {
                type: "LineString",
                coordinates: coords.map((item) => [item.lon, item.lat])
            };
            return res;
        }
        applyTransform(m, point) {
            return { x: point.x * m[0] + point.y * m[2] + m[4], y: point.x * m[1] + point.y * m[3] + m[5] };
        }
    }

    class LeafletMap {
        constructor(apiKey, mapDivId, mapCenter, zoomLevel) {
            this.strokeStart = '';
            this.strokeEnd = '';
            this.strokePoly = null;
            this.featureLayers = new Map();
            this.load = async () => { await this.initMap(); };
            this.apiKey = apiKey;
            this.mapDivId = mapDivId;
            this.mapCenter = mapCenter;
            this.zoomLevel = zoomLevel;
        }
        async initMap() {
            const mapDiv = document.getElementById(this.mapDivId);
            if (!mapDiv)
                throw new Error("Html page must contain a 'map' div");
            this.map = L.map(mapDiv).setView([this.mapCenter.lat, this.mapCenter.lon], this.zoomLevel);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(this.map);
            this.map.getContainer().style.cursor = 'crosshair';
            const style = document.createElement('style');
            style.textContent = '.leaflet-container, .leaflet-interactive { cursor: crosshair !important; }';
            document.head.appendChild(style);
            this.geoJsonLayer = L.geoJSON(null, {
                onEachFeature: (feature, layer) => {
                    const poid = feature.id || (feature.properties && feature.properties.poid);
                    if (poid)
                        this.featureLayers.set(poid, layer);
                    layer.on('click', () => {
                        const symbol = (feature.properties && feature.properties.symbol) || feature.symbol;
                        if (symbol)
                            this.onSelection?.call(this, symbol);
                    });
                }
            }).addTo(this.map);
            this.map.on('mousedown', (e) => {
                const domEvt = e.originalEvent;
                if (domEvt && domEvt.ctrlKey)
                    return false;
                domEvt && domEvt.preventDefault();
                this.enableDrawing();
                const latlng = e.latlng;
                this.onStrokeStart?.call(this, new LatLon(latlng.lat, latlng.lng), this.getIsoTimestamp());
                this.drawFreeHand(latlng);
            });
        }
        drawFreeHand(latlng) {
            this.strokeStart = this.getIsoTimestamp();
            this.clearInk();
            this.strokePoly = L.polyline([], { color: '#8B0000', weight: 2 }).addTo(this.map);
            this.strokePoly.addLatLng(latlng);
            const moveHandler = (e) => { this.strokePoly.addLatLng(e.latlng); };
            const upHandler = () => {
                this.strokeEnd = this.getIsoTimestamp();
                this.disableDrawing();
                this.map.off('mousemove', moveHandler);
                this.map.off('mouseup', upHandler);
                const pts = this.strokePoly.getLatLngs();
                if (pts.length === 1)
                    pts.push(pts[0]);
                const strokeLatLng = pts.map((p) => new LatLon(p.lat, p.lng));
                const sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
                const b = this.map.getBounds();
                this.onStrokeCompleted?.call(this, new Size(sizePixels.width, sizePixels.height), new LatLon(b.getNorthEast().lat, b.getSouthWest().lng), new LatLon(b.getSouthWest().lat, b.getNorthEast().lng), strokeLatLng, this.strokeStart, this.strokeEnd, []);
            };
            this.map.on('mousemove', moveHandler);
            this.map.on('mouseup', upHandler);
        }
        enableDrawing() {
            this.map.dragging.disable();
            this.map.scrollWheelZoom.disable();
            this.map.doubleClickZoom.disable();
            this.map.getContainer().style.cursor = 'crosshair';
        }
        disableDrawing() {
            this.map.dragging.enable();
            this.map.scrollWheelZoom.enable();
            this.map.doubleClickZoom.enable();
            this.map.getContainer().style.cursor = 'crosshair';
        }
        addFeature(symbolGeoJSON) { if (symbolGeoJSON)
            this.geoJsonLayer.addData(symbolGeoJSON); }
        removeFeature(poid) {
            const layer = this.featureLayers.get(poid);
            if (layer) {
                this.geoJsonLayer.removeLayer(layer);
                this.featureLayers.delete(poid);
            }
        }
        displayInfo(content, location, handlers) {
            const node = document.createElement('div');
            node.innerHTML = content;
            const popup = L.popup({ closeButton: true })
                .setLatLng([location.lat, location.lon])
                .setContent(node)
                .openOn(this.map);
            if (popup && handlers && handlers.length) {
                for (let i = 0; i < handlers.length; i++) {
                    const instance = node.querySelector(handlers[i].selector);
                    if (instance && handlers[i].handler) {
                        instance.addEventListener('click', (event) => {
                            if (handlers[i].closeInfo)
                                popup.remove();
                            handlers[i].handler(event);
                        });
                    }
                }
            }
        }
        clearInk() { if (this.strokePoly) {
            this.map.removeLayer(this.strokePoly);
            this.strokePoly = null;
        } }
        getBounds() { return this.map.getBounds(); }
        getIsoTimestamp() { return new Date().toISOString(); }
    }

    class MockRecognizer {
        async connect(serviceName, timeout, machineId) {
            this.onStpMessage?.(`Connected to mock STP (${serviceName || "Mock"})`, "Info");
        }
        async disconnect(timeout) {
            this.onStpMessage?.("Disconnected from mock STP", "Info");
        }
        sendPenDown(location, timestamp) { }
        sendInk(pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids) {
            this.onInkProcessed?.();
            const poid = `mock-${Date.now()}`;
            const isPoint = strokePoints && strokePoints.length <= 2;
            const centroid = isPoint ? strokePoints[0] : strokePoints[Math.floor(strokePoints.length / 2)];
            const symbol = new MockSymbol(poid, centroid, strokePoints, isPoint ? "point" : "line");
            symbol.affiliation = "friend";
            symbol.fullDescription = isPoint ? "Mock Point" : "Mock Graphic";
            symbol.description = symbol.fullDescription;
            this.onSymbolAdded?.([symbol], false);
        }
        sendSpeechRecognition(results, startTime, endTime) {
            const phrases = (results || []).map(r => r.text);
            this.onSpeechRecognized?.(phrases);
        }
        deleteSymbol(poid) { this.onSymbolDeleted?.(poid, false); }
    }
    class MockSymbol {
        constructor(poid, centroid, coords, shape) {
            this.poid = poid;
            this.location = { fsTYPE: shape === "point" ? "point" : "line", shape, centroid, coords: coords || [] };
            this.affiliation = "unknown";
            this.fullDescription = "Mock Symbol";
            this.description = this.fullDescription;
            this.sidc = {};
        }
        asGeoJSON() {
            const isPoint = this.location.fsTYPE === "point";
            return {
                type: "Feature",
                id: this.poid,
                properties: { poid: this.poid, symbol: this, description: this.description, affiliation: this.affiliation },
                geometry: isPoint
                    ? { type: "Point", coordinates: [this.location.centroid.lon, this.location.centroid.lat] }
                    : { type: "LineString", coordinates: (this.location.coords || []).map(p => [p.lon, p.lat]) }
            };
        }
    }

    let azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
    let azureServiceRegion = "<Enter Azure's subscription region>";
    let azureEndPoint = null;
    let mapCenter = new LatLon(58.967774948, 11.196062412);
    let zoomLevel = 13;
    let webSocketUrl = "ws://<STP server>:<STP port>";
    window.onload = () => start();
    let stpsdk;
    let map;
    async function start() {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.get('mapkey');
        const latParm = urlParams.get('lat');
        const lonParm = urlParams.get('lon');
        if (latParm && lonParm)
            mapCenter = new LatLon(parseFloat(latParm), parseFloat(lonParm));
        const zoomParm = urlParams.get('zoom');
        if (zoomParm)
            zoomLevel = parseInt(zoomParm);
        const azKey = urlParams.get('azkey');
        if (azKey)
            azureSubscriptionKey = azKey;
        const azRegion = urlParams.get('azregion');
        if (azRegion)
            azureServiceRegion = azRegion;
        urlParams.get('azlang');
        const azEndp = urlParams.get('azendp');
        if (azEndp)
            azureEndPoint = azEndp;
        const stpParm = urlParams.get('stpurl');
        if (stpParm)
            webSocketUrl = stpParm;
        const stpconn = new StpWebSocketsConnector(webSocketUrl);
        stpsdk = new StpRecognizer(stpconn);
        stpsdk.onSymbolAdded = (alternates, isUndo) => {
            let gj = new BasicRenderer(alternates[0]).asGeoJSON();
            map.addFeature(gj);
        };
        stpsdk.onSymbolModified = (poid, symbol, isUndo) => {
            map.removeFeature(poid);
            let gj = new BasicRenderer(symbol).asGeoJSON();
            map.addFeature(gj);
        };
        stpsdk.onSymbolDeleted = (poid, isUndo) => {
            map.removeFeature(poid);
        };
        stpsdk.onInkProcessed = () => {
            map.clearInk();
        };
        stpsdk.onSpeechRecognized = (phrases) => {
            let speech = "";
            if (phrases && phrases.length > 0) {
                speech = phrases[0];
            }
            log(speech);
        };
        stpsdk.onStpMessage = (msg, level) => {
            log(msg, level, true);
        };
        const forceMock = urlParams.get('mock') !== null;
        try {
            if (forceMock)
                throw new Error('Mock requested');
            await stpsdk.connect("LeafletSampleTS", 10);
        }
        catch (error) {
            stpsdk = new MockRecognizer();
            await stpsdk.connect("LeafletSampleTS-Mock", 1);
            log("Using mock STP locally (no backend)");
        }
        map = new LeafletMap(null, 'map', mapCenter, zoomLevel);
        map.onStrokeStart = (location, timestamp) => {
            stpsdk.sendPenDown(location, timestamp);
            recognizeSpeech();
        };
        map.onStrokeCompleted = (pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids) => {
            stpsdk.sendInk(pixelBoundsWindow, topLeftGeoMap, bottomRightGeoMap, strokePoints, timeStrokeStart, timeStrokeEnd, intersectedPoids);
        };
        map.onSelection = (symbol) => {
            let contentString = buildInfo(symbol);
            if (contentString && symbol && symbol.poid && symbol.location && symbol.location.centroid) {
                map.displayInfo(contentString, symbol.location.centroid, [
                    { selector: '#delButton',
                        handler: (event) => {
                            stpsdk.deleteSymbol(symbol.poid);
                        },
                        closeInfo: true }
                ]);
            }
        };
        map.load();
    }
    async function recognizeSpeech() {
        try {
            const speechreco = new AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint);
            let recoResult = await speechreco.recognizeOnce();
            if (recoResult) {
                const startIso = recoResult.startTime?.toISOString?.() ?? String(recoResult.startTime);
                const endIso = recoResult.endTime?.toISOString?.() ?? String(recoResult.endTime);
                stpsdk.sendSpeechRecognition(recoResult.results, startIso, endIso);
                if (recoResult.results && recoResult.results.length > 0) {
                    log(recoResult.results[0].text);
                }
            }
        }
        catch (e) {
            let msg = "Failed to process speech: " + e.message;
            log(msg);
        }
    }
    function buildInfo(symbol) {
        if (!symbol || !symbol.location || !symbol.location.centroid) {
            return null;
        }
        let contentString = '<h3 id="firstHeading" class="firstHeading">' + symbol.fullDescription + '</h3>' +
            '<table>' +
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
    function log(msg, level, showAlert) {
        if (showAlert) {
            alert(msg);
        }
        let control = document.getElementById("messages");
        if (!control) {
            throw new Error("Html page must contain a 'messages' div");
        }
        control.innerHTML = msg;
        control.style.color = level === "Error" ? "red" : "black";
    }

})(SpeechSDK);
