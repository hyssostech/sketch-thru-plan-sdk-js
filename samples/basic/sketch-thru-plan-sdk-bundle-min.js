(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.StpSDK = {}));
})(this, (function (exports) { 'use strict';

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

    exports.StpMessageLevel = void 0;
    (function (StpMessageLevel) {
        StpMessageLevel["Error"] = "Error";
        StpMessageLevel["Warning"] = "Warning";
        StpMessageLevel["Info"] = "Info";
        StpMessageLevel["Debug"] = "Debug";
    })(exports.StpMessageLevel || (exports.StpMessageLevel = {}));
    exports.StpRole = void 0;
    (function (StpRole) {
        StpRole["s2"] = "S2";
        StpRole["s3"] = "S3";
        StpRole["s4"] = "S4";
        StpRole["fso"] = "FSO";
        StpRole["eng"] = "ENG";
    })(exports.StpRole || (exports.StpRole = {}));
    class StpItem {
    }
    class StpSymbol extends StpItem {
        get deltaSIDC() {
            const s = this.sidc;
            if (!s)
                return undefined;
            if (s.partA && s.partB && s.partC)
                return `${s.partA}${s.partB}${s.partC}`;
            if (s.partA && s.partB)
                return `${s.partA}${s.partB}`;
            if (s.partA)
                return `${s.partA}`;
            if (s.delta)
                return s.delta;
            return undefined;
        }
        get charlieSIDC() {
            const s = this.sidc;
            if (!s)
                return undefined;
            return s.charlie ?? s.legacy;
        }
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
    exports.CommandRelationship = void 0;
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
    })(exports.CommandRelationship || (exports.CommandRelationship = {}));
    class StpTask extends StpItem {
    }
    class StpCoa {
    }
    class TaskOrgState {
    }
    class Sidc {
        get partA() {
            const d = this.delta;
            if (!d || d.length < 10)
                return undefined;
            return d.substring(0, 10);
        }
        ;
        get partB() {
            const d = this.delta;
            if (!d || d.length < 20)
                return undefined;
            return d.substring(10, 20);
        }
        ;
        get partC() {
            const d = this.delta;
            if (!d || d.length < 30)
                return undefined;
            return d.substring(20, 30);
        }
        ;
        get charlie() {
            return this.legacy;
        }
        ;
        static fromPlain(obj) {
            const sidc = new Sidc();
            if (obj.delta) {
                sidc.delta = obj.delta;
            }
            else {
                const a = obj.partA ?? '';
                const b = obj.partB ?? '';
                const c = obj.partC ?? '';
                const combined = `${a}${b}${c}`;
                if (combined.length > 0)
                    sidc.delta = combined;
            }
            sidc.legacy = obj.legacy;
            sidc.symbolSet = obj.symbolSet;
            return sidc;
        }
    }
    class Location {
    }
    class MovementFeatures {
    }
    exports.TaskWhat = void 0;
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
    })(exports.TaskWhat || (exports.TaskWhat = {}));
    exports.TaskHow = void 0;
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
    })(exports.TaskHow || (exports.TaskHow = {}));
    exports.TaskWhy = void 0;
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
    })(exports.TaskWhy || (exports.TaskWhy = {}));
    exports.TaskROE = void 0;
    (function (TaskROE) {
        TaskROE["NotSpecified"] = "not_specified";
        TaskROE["Hold"] = "hold";
        TaskROE["Tight"] = "tight";
        TaskROE["Free"] = "free";
    })(exports.TaskROE || (exports.TaskROE = {}));
    class LatLon {
        constructor(lat, lon) {
            this.lat = lat;
            this.lon = lon;
        }
        equals(rhs) {
            return this.lat == rhs.lat && this.lon == rhs.lon;
        }
    }
    class Interval {
        constructor(start, end) {
            this.start = start;
            this.end = end;
        }
        equals(rhs) {
            return this.start == rhs.start && this.end == rhs.end;
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
    class DISCode {
        constructor(category, country, domain, extra, kind, specific, subcategory) {
            this.category = category;
            this.country = country;
            this.domain = domain;
            this.extra = extra;
            this.kind = kind;
            this.specific = specific;
            this.subcategory = subcategory;
        }
        equals(rhs) {
            if (rhs === undefined) {
                return false;
            }
            return this.category == rhs.category &&
                this.country == rhs.country &&
                this.domain == rhs.domain &&
                this.extra == rhs.extra &&
                this.kind == rhs.kind &&
                this.specific == rhs.specific &&
                this.subcategory == rhs.subcategory;
        }
    }
    class Resource {
        constructor(name, operationalQuantity, disCode, onHandQuantity, requiredOnHandQuantity) {
            this.name = name;
            this.operationalQuantity = operationalQuantity;
            this.disCode = disCode;
            this.onHandQuantity = onHandQuantity;
            this.requiredOnHandQuantity = requiredOnHandQuantity;
        }
        equals(rhs) {
            if (rhs === undefined) {
                return false;
            }
            return this.name == rhs.name &&
                this.operationalQuantity == rhs.operationalQuantity &&
                this.disCode == rhs.disCode &&
                this.onHandQuantity == rhs.onHandQuantity &&
                this.requiredOnHandQuantity == rhs.requiredOnHandQuantity;
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
                this.onStpMessage(error, exports.StpMessageLevel.Error);
            }
        }
        handleInform(msg) {
            if (msg.method === 'SymbolAdded' && this.onSymbolAdded) {
                const pp = msg.params;
                let alts = [];
                for (let i = 0; i < pp.alternates.length; i++) {
                    const symbol = Object.assign(new StpSymbol(), pp.alternates[i]);
                    if (symbol.sidc)
                        symbol.sidc = Sidc.fromPlain(symbol.sidc);
                    alts.push(symbol);
                }
                this.onSymbolAdded(alts, pp.isUndo);
            }
            else if (msg.method === 'SymbolModified' && this.onSymbolModified) {
                const pp = msg.params;
                const symbol = Object.assign(new StpSymbol(), pp.symbol);
                if (symbol.sidc)
                    symbol.sidc = Sidc.fromPlain(symbol.sidc);
                this.onSymbolModified(pp.poid, symbol, pp.isUndo);
            }
            else if (msg.method === 'SymbolDeleted' && this.onSymbolDeleted) {
                const pp = msg.params;
                this.onSymbolDeleted(pp.poid, pp.isUndo);
            }
            else if (msg.method === 'SymbolReport' && this.onSymbolReport) {
                const pp = msg.params;
                const symbol = Object.assign(new StpSymbol(), pp.symbol);
                if (symbol.sidc)
                    symbol.sidc = Sidc.fromPlain(symbol.sidc);
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
                if (unit.sidc)
                    unit.sidc = Sidc.fromPlain(unit.sidc);
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
                    this.onStpMessage(e.message, exports.StpMessageLevel.Error);
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
                    this.onStpMessage(e.message, exports.StpMessageLevel.Error);
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
        sendSimulatedSpeechRecognition(text, startTime) {
            this.informStp('SendSimulatedSpeechRecognition', {
                text: arguments[0],
                startTime: arguments[1] ?? null
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
                this.timeout = timeout;
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
                    reject(new Error('Failed to send inform: socket is not available'));
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
                    reject(new Error('Failed to send request: socket is not available'));
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

    class StpC2SIMOptions {
    }

    exports.DISCode = DISCode;
    exports.Interval = Interval;
    exports.LatLon = LatLon;
    exports.Location = Location;
    exports.MovementFeatures = MovementFeatures;
    exports.Resource = Resource;
    exports.Sidc = Sidc;
    exports.Size = Size;
    exports.StpC2SIMOptions = StpC2SIMOptions;
    exports.StpCoa = StpCoa;
    exports.StpItem = StpItem;
    exports.StpRecognizer = StpRecognizer;
    exports.StpSymbol = StpSymbol;
    exports.StpTask = StpTask;
    exports.StpTaskOrg = StpTaskOrg;
    exports.StpTaskOrgRelationship = StpTaskOrgRelationship;
    exports.StpTaskOrgUnit = StpTaskOrgUnit;
    exports.StpWebSocketsConnector = StpWebSocketsConnector;
    exports.TaskOrgState = TaskOrgState;

}));
