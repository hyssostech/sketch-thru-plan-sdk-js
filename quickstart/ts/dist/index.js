(function (require$$0) {
    'use strict';

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
    class StpItem {
    }
    class StpSymbol extends StpItem {
        asGeoJSON() {
            var _a, _b, _c, _d, _e, _f;
            if (this.location == undefined ||
                this.location.coords == undefined ||
                ((_a = this.location) === null || _a === void 0 ? void 0 : _a.coords.length) == 0) {
                throw new Error('Coordinates are undefined or empty');
            }
            let geom;
            if (((_b = this.location) === null || _b === void 0 ? void 0 : _b.fsTYPE) === 'point') {
                geom = {
                    type: 'Point',
                    coordinates: [this.location.coords[0].lon, this.location.coords[0].lat]
                };
            }
            else if (((_c = this.location) === null || _c === void 0 ? void 0 : _c.fsTYPE) === 'line') {
                geom = {
                    type: 'LineString',
                    coordinates: this.location.coords.map((item) => [item.lon, item.lat])
                };
            }
            else if (((_d = this.location) === null || _d === void 0 ? void 0 : _d.fsTYPE) === 'area') {
                geom = {
                    type: 'Polygon',
                    coordinates: [this.location.coords.map((item) => [item.lon, item.lat])]
                };
                geom = rewind(geom, false);
            }
            else if (((_e = this.location) === null || _e === void 0 ? void 0 : _e.fsTYPE) === 'multipoint') {
                geom = {
                    type: 'MultiPoint',
                    coordinates: this.location.coords.map((item) => [item.lon, item.lat])
                };
            }
            else {
                throw new Error('Expected "point", "line", "area", or "multipoint" geometry type. Got: ' + ((_f = this.location) === null || _f === void 0 ? void 0 : _f.fsTYPE));
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

    var __awaiter$1 = function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    class StpRecognizer {
        constructor(stpConnector) {
            this.stpConnector = stpConnector;
            this.serviceName = '';
        }
        connect(serviceName, timeout, machineId) {
            return __awaiter$1(this, void 0, void 0, function* () {
                this.serviceName = serviceName;
                this.stpConnector.onInform = this.onInform.bind(this);
                this.stpConnector.onRequest = this.onRequest.bind(this);
                this.stpConnector.onError = this.onError.bind(this);
                try {
                    let solvables = this.buildSolvables();
                    return this.stpConnector.connect(this.serviceName, solvables, timeout, machineId);
                }
                catch (e) {
                    throw e;
                }
            });
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
        sendPenDown(location, timestamp) {
            return __awaiter$1(this, arguments, void 0, function* () {
                this.informStp('SendPenDown', {
                    location: arguments[0],
                    timestamp: arguments[1]
                });
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
            else if (msg.method === 'InkProcessed' && this.onInkProcessed) {
                this.onInkProcessed();
            }
            else if (msg.method === 'SpeechRecognized' && this.onSpeechRecognized) {
                const pp = msg.params;
                this.onSpeechRecognized(pp.phrases);
            }
            else if (msg.method === 'StpMessage' && this.onStpMessage) {
                const pp = msg.params;
                this.onStpMessage(pp.message, pp.level);
            }
            else {
                console.log('Received message with no handler: ' + msg.method);
            }
        }
    }

    var __awaiter$1$1 = function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    class StpWebSocketsConnector {
        constructor(connstring) {
            this.DEFAULT_TIMEOUT = 30;
            this.connstring = connstring;
            this.socket = null;
        }
        get isConnected() {
            return this.socket != null && this.socket.readyState === this.socket.OPEN;
        }
        get isConnecting() {
            return (this.socket != null && this.socket.readyState === this.socket.CONNECTING);
        }
        get connState() {
            return this.socket ? this.socket.readyState.toString() : '';
        }
        connect(serviceName, solvables, timeout = this.DEFAULT_TIMEOUT, machineId = null) {
            return __awaiter$1$1(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => __awaiter$1$1(this, void 0, void 0, function* () {
                    if (this.isConnected) {
                        resolve();
                    }
                    this.serviceName = serviceName;
                    this.solvables = solvables;
                    if (machineId != null) {
                        this.machineId = machineId;
                    }
                    if (timeout <= 0) {
                        timeout = this.DEFAULT_TIMEOUT;
                    }
                    try {
                        this.socket = yield this.promiseWithTimeout(timeout, this.tryConnect(this.connstring));
                        yield this.register();
                    }
                    catch (e) {
                        reject(new Error('Failed to connect: ' + e.message));
                        return;
                    }
                    this.socket.onmessage = (ev) => {
                        if (this.onInform)
                            this.onInform(ev.data);
                    };
                    this.socket.onerror = (ev) => {
                        if (this.onError) {
                            this.onError('Error connecting to STP. Check that the service is running and refresh page to retry');
                        }
                    };
                    this.socket.onclose = (ev) => __awaiter$1$1(this, void 0, void 0, function* () {
                        if (!this.isConnecting) {
                            try {
                                yield this.connect(this.serviceName, this.solvables, this.timeout, this.machineId);
                            }
                            catch (error) {
                                if (this.onError) {
                                    this.onError('Lost connection to STP. Check that the service is running and refresh page to retry');
                                }
                            }
                        }
                    });
                    resolve();
                }));
            });
        }
        register() {
            if (!this.isConnected) {
                throw new Error('Failed to register: connection is not open (' + this.connState + ')');
            }
            return this.promiseWithTimeout(this.timeout || this.DEFAULT_TIMEOUT, new Promise((resolve, reject) => __awaiter$1$1(this, void 0, void 0, function* () {
                if (!this.socket) {
                    return;
                }
                this.name = this.serviceName;
                this.socket.send(JSON.stringify({
                    method: 'Register',
                    params: {
                        serviceName: this.name,
                        language: 'javascript',
                        solvables: this.solvables,
                        machineId: this.machineId || this.getUniqueId(9)
                    }
                }));
                resolve();
            })));
        }
        disconnect(timeout = this.DEFAULT_TIMEOUT) {
            return this.promiseWithTimeout(timeout, new Promise((resolve, reject) => __awaiter$1$1(this, void 0, void 0, function* () {
                if (!this.isConnected && this.socket) {
                    this.socket.close();
                }
                resolve();
            })));
        }
        inform(message, timeout = this.DEFAULT_TIMEOUT) {
            if (!this.isConnected) {
                throw new Error('Failed to send inform: connection is not open (' + this.connState + ')');
            }
            return this.promiseWithTimeout(timeout, new Promise((resolve, reject) => __awaiter$1$1(this, void 0, void 0, function* () {
                if (!this.socket) {
                    return;
                }
                this.socket.send(message);
                resolve();
            })));
        }
        request(message, timeout = this.DEFAULT_TIMEOUT) {
            throw new Error('Method not implemented');
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

    var stpazurespeechBundleMin = {exports: {}};

    (function (module, exports) {
    	var t;t=function(e,t){var i=function(e,t,i,n){return new(i||(i=Promise))((function(o,s){function r(e){try{a(n.next(e));}catch(e){s(e);}}function c(e){try{a(n.throw(e));}catch(e){s(e);}}function a(e){var t;e.done?o(e.value):(t=e.value,t instanceof i?t:new i((function(e){e(t);}))).then(r,c);}a((n=n.apply(e,t||[])).next());}))};class n{constructor(){this.results=[],this.startTime=new Date,this.endTime=new Date;}}class o{constructor(e,t){this.text=e,this.confidence=t;}}class s{constructor(){this.RecognitionStatus="",this.Offset=0,this.Duration=0,this.DisplayText="",this.NBest=[];}}e.AzureSpeechRecognizer=class{constructor(e,i,n,o){this.speechSubscriptionKey=e,this.serviceRegion=i,this.speechConfig=t.SpeechConfig.fromSubscription(this.speechSubscriptionKey,this.serviceRegion),this.speechConfig.outputFormat=t.OutputFormat.Detailed,n&&(this.speechConfig.endpointId=n),this.audioConfig=o||t.AudioConfig.fromDefaultMicrophoneInput();}recognizeOnce(e){return e||(e=8),this.recognizer=new t.SpeechRecognizer(this.speechConfig,this.audioConfig),new Promise(((t,n)=>i(this,void 0,void 0,(function*(){var i;for(let i=0;i<e;i++){this.recoStart=new Date;try{const e=yield this.tryReco(this.recoStart);return void t(e)}catch(e){}i<e-1&&(yield new Promise((e=>setTimeout(e,250))));}let o=new Error("Failed to recognize speech");null===(i=this.onError)||void 0===i||i.call(this,o),n(o);}))))}tryReco(e){return new Promise(((i,n)=>{var o;this.recognizer.recognizing=(e,t)=>{var i;null===(i=this.onRecognizing)||void 0===i||i.call(this,t.result.text);},this.recognizer.recognized=(t,n)=>{var o;let s=this.convertResults(e,n.result);null===(o=this.onRecognized)||void 0===o||o.call(this,s),i(s);},this.recognizer.canceled=(e,i)=>{n(new Error(t.CancellationReason[i.reason]));},null===(o=this.recognizer)||void 0===o||o.recognizeOnceAsync();}))}startRecognizing(){this.recognizer=new t.SpeechRecognizer(this.speechConfig,this.audioConfig),this.recoStart=new Date,this.recognizer.recognizing=(e,t)=>{var i;null===(i=this.onRecognizing)||void 0===i||i.call(this,t.result.text);},this.recognizer.recognized=(e,t)=>{var i;let n=this.convertResults(this.recoStart,t.result);null===(i=this.onRecognized)||void 0===i||i.call(this,n);},this.recognizer.canceled=(e,i)=>{var n;let o=new Error(t.CancellationReason[i.reason]);this.onError?this.onError.call(this,o):null===(n=this.onRecognized)||void 0===n||n.call(this,null);},this.recognizer.startContinuousRecognitionAsync();}stopRecognizing(e){this.recognizer&&setTimeout((()=>{var e;null===(e=this.recognizer)||void 0===e||e.close(),this.recognizer=void 0;}),e||0);}convertResults(e,i){if(i.reason===t.ResultReason.NoMatch)return null;let r=new n;r.startTime=this.addTicksToDate(e,i.offset),r.endTime=this.addTicksToDate(r.startTime,i.duration);let c=i.properties.getProperty(t.PropertyId.SpeechServiceResponse_JsonResult);const a=Object.assign(new s,JSON.parse(c)).NBest.map((e=>new o(e.Lexical,e.Confidence)));let h=Array.from(a);for(let e=0;e<a.length;e++){const t=a[e];if(t.text.search(/^([a-zA-Z]\s)+[a-zA-Z]$/)>=0){const e=t.text.replace(/\s/g,""),i=.9*t.confidence;h.push(new o(e,i));}else if(t.text.search(/^([a-zA-Z]\s)+[a-zA-Z]+$/)>=0){let e=t.text.match(/^(([a-zA-Z]\s)+)([a-zA-Z]+)$/);if(e&&4==e.length){const i=e[1].replace(/\s/g,""),n=e[3],s=.7*t.confidence;h.push(new o(i+" "+n,s));}}}return r.results=h.sort(((e,t)=>t.confidence-e.confidence)),r}addTicksToDate(e,t){let i=1e4*e.getTime()+621355968e9;return new Date((i+t-621355968e9)/1e4)}},Object.defineProperty(e,"__esModule",{value:!0});},t(exports,require$$0); 
    } (stpazurespeechBundleMin, stpazurespeechBundleMin.exports));

    var stpazurespeechBundleMinExports = stpazurespeechBundleMin.exports;

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

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    // do not edit .js files directly - edit src/index.jst



    var fastDeepEqual = function equal(a, b) {
      if (a === b) return true;

      if (a && b && typeof a == 'object' && typeof b == 'object') {
        if (a.constructor !== b.constructor) return false;

        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0;)
            if (!equal(a[i], b[i])) return false;
          return true;
        }



        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;

        for (i = length; i-- !== 0;)
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

        for (i = length; i-- !== 0;) {
          var key = keys[i];

          if (!equal(a[key], b[key])) return false;
        }

        return true;
      }

      // true if both NaN, false otherwise
      return a!==a && b!==b;
    };

    /**
     * Copyright 2019 Google LLC. All Rights Reserved.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at.
     *
     *      Http://www.apache.org/licenses/LICENSE-2.0.
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const DEFAULT_ID = "__googleMapsScriptId";
    /**
     * The status of the [[Loader]].
     */
    var LoaderStatus;
    (function (LoaderStatus) {
        LoaderStatus[LoaderStatus["INITIALIZED"] = 0] = "INITIALIZED";
        LoaderStatus[LoaderStatus["LOADING"] = 1] = "LOADING";
        LoaderStatus[LoaderStatus["SUCCESS"] = 2] = "SUCCESS";
        LoaderStatus[LoaderStatus["FAILURE"] = 3] = "FAILURE";
    })(LoaderStatus || (LoaderStatus = {}));
    /**
     * [[Loader]] makes it easier to add Google Maps JavaScript API to your application
     * dynamically using
     * [Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).
     * It works by dynamically creating and appending a script node to the the
     * document head and wrapping the callback function so as to return a promise.
     *
     * ```
     * const loader = new Loader({
     *   apiKey: "",
     *   version: "weekly",
     *   libraries: ["places"]
     * });
     *
     * loader.load().then((google) => {
     *   const map = new google.maps.Map(...)
     * })
     * ```
     */
    class Loader {
        /**
         * Creates an instance of Loader using [[LoaderOptions]]. No defaults are set
         * using this library, instead the defaults are set by the Google Maps
         * JavaScript API server.
         *
         * ```
         * const loader = Loader({apiKey, version: 'weekly', libraries: ['places']});
         * ```
         */
        constructor({ apiKey, authReferrerPolicy, channel, client, id = DEFAULT_ID, language, libraries = [], mapIds, nonce, region, retries = 3, url = "https://maps.googleapis.com/maps/api/js", version, }) {
            this.callbacks = [];
            this.done = false;
            this.loading = false;
            this.errors = [];
            this.apiKey = apiKey;
            this.authReferrerPolicy = authReferrerPolicy;
            this.channel = channel;
            this.client = client;
            this.id = id || DEFAULT_ID; // Do not allow empty string
            this.language = language;
            this.libraries = libraries;
            this.mapIds = mapIds;
            this.nonce = nonce;
            this.region = region;
            this.retries = retries;
            this.url = url;
            this.version = version;
            if (Loader.instance) {
                if (!fastDeepEqual(this.options, Loader.instance.options)) {
                    throw new Error(`Loader must not be called again with different options. ${JSON.stringify(this.options)} !== ${JSON.stringify(Loader.instance.options)}`);
                }
                return Loader.instance;
            }
            Loader.instance = this;
        }
        get options() {
            return {
                version: this.version,
                apiKey: this.apiKey,
                channel: this.channel,
                client: this.client,
                id: this.id,
                libraries: this.libraries,
                language: this.language,
                region: this.region,
                mapIds: this.mapIds,
                nonce: this.nonce,
                url: this.url,
                authReferrerPolicy: this.authReferrerPolicy,
            };
        }
        get status() {
            if (this.errors.length) {
                return LoaderStatus.FAILURE;
            }
            if (this.done) {
                return LoaderStatus.SUCCESS;
            }
            if (this.loading) {
                return LoaderStatus.LOADING;
            }
            return LoaderStatus.INITIALIZED;
        }
        get failed() {
            return this.done && !this.loading && this.errors.length >= this.retries + 1;
        }
        /**
         * CreateUrl returns the Google Maps JavaScript API script url given the [[LoaderOptions]].
         *
         * @ignore
         * @deprecated
         */
        createUrl() {
            let url = this.url;
            url += `?callback=__googleMapsCallback`;
            if (this.apiKey) {
                url += `&key=${this.apiKey}`;
            }
            if (this.channel) {
                url += `&channel=${this.channel}`;
            }
            if (this.client) {
                url += `&client=${this.client}`;
            }
            if (this.libraries.length > 0) {
                url += `&libraries=${this.libraries.join(",")}`;
            }
            if (this.language) {
                url += `&language=${this.language}`;
            }
            if (this.region) {
                url += `&region=${this.region}`;
            }
            if (this.version) {
                url += `&v=${this.version}`;
            }
            if (this.mapIds) {
                url += `&map_ids=${this.mapIds.join(",")}`;
            }
            if (this.authReferrerPolicy) {
                url += `&auth_referrer_policy=${this.authReferrerPolicy}`;
            }
            return url;
        }
        deleteScript() {
            const script = document.getElementById(this.id);
            if (script) {
                script.remove();
            }
        }
        /**
         * Load the Google Maps JavaScript API script and return a Promise.
         * @deprecated, use importLibrary() instead.
         */
        load() {
            return this.loadPromise();
        }
        /**
         * Load the Google Maps JavaScript API script and return a Promise.
         *
         * @ignore
         * @deprecated, use importLibrary() instead.
         */
        loadPromise() {
            return new Promise((resolve, reject) => {
                this.loadCallback((err) => {
                    if (!err) {
                        resolve(window.google);
                    }
                    else {
                        reject(err.error);
                    }
                });
            });
        }
        importLibrary(name) {
            this.execute();
            return google.maps.importLibrary(name);
        }
        /**
         * Load the Google Maps JavaScript API script with a callback.
         * @deprecated, use importLibrary() instead.
         */
        loadCallback(fn) {
            this.callbacks.push(fn);
            this.execute();
        }
        /**
         * Set the script on document.
         */
        setScript() {
            var _a, _b;
            if (document.getElementById(this.id)) {
                // TODO wrap onerror callback for cases where the script was loaded elsewhere
                this.callback();
                return;
            }
            const params = {
                key: this.apiKey,
                channel: this.channel,
                client: this.client,
                libraries: this.libraries.length && this.libraries,
                v: this.version,
                mapIds: this.mapIds,
                language: this.language,
                region: this.region,
                authReferrerPolicy: this.authReferrerPolicy,
            };
            // keep the URL minimal:
            Object.keys(params).forEach(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (key) => !params[key] && delete params[key]);
            if (!((_b = (_a = window === null || window === void 0 ? void 0 : window.google) === null || _a === void 0 ? void 0 : _a.maps) === null || _b === void 0 ? void 0 : _b.importLibrary)) {
                // tweaked copy of https://developers.google.com/maps/documentation/javascript/load-maps-js-api#dynamic-library-import
                // which also sets the base url, the id, and the nonce
                /* eslint-disable */
                ((g) => {
                    // @ts-ignore
                    let h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
                    // @ts-ignore
                    b = b[c] || (b[c] = {});
                    // @ts-ignore
                    const d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(), u = () => 
                    // @ts-ignore
                    h || (h = new Promise((f, n) => __awaiter(this, void 0, void 0, function* () {
                        var _a;
                        yield (a = m.createElement("script"));
                        a.id = this.id;
                        e.set("libraries", [...r] + "");
                        // @ts-ignore
                        for (k in g)
                            e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[k]);
                        e.set("callback", c + ".maps." + q);
                        a.src = this.url + `?` + e;
                        d[q] = f;
                        a.onerror = () => (h = n(Error(p + " could not load.")));
                        // @ts-ignore
                        a.nonce = this.nonce || ((_a = m.querySelector("script[nonce]")) === null || _a === void 0 ? void 0 : _a.nonce) || "";
                        m.head.append(a);
                    })));
                    // @ts-ignore
                    d[l] ? console.warn(p + " only loads once. Ignoring:", g) : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
                })(params);
                /* eslint-enable */
            }
            // While most libraries populate the global namespace when loaded via bootstrap params,
            // this is not the case for "marker" when used with the inline bootstrap loader
            // (and maybe others in the future). So ensure there is an importLibrary for each:
            const libraryPromises = this.libraries.map((library) => this.importLibrary(library));
            // ensure at least one library, to kick off loading...
            if (!libraryPromises.length) {
                libraryPromises.push(this.importLibrary("core"));
            }
            Promise.all(libraryPromises).then(() => this.callback(), (error) => {
                const event = new ErrorEvent("error", { error }); // for backwards compat
                this.loadErrorCallback(event);
            });
        }
        /**
         * Reset the loader state.
         */
        reset() {
            this.deleteScript();
            this.done = false;
            this.loading = false;
            this.errors = [];
            this.onerrorEvent = null;
        }
        resetIfRetryingFailed() {
            if (this.failed) {
                this.reset();
            }
        }
        loadErrorCallback(e) {
            this.errors.push(e);
            if (this.errors.length <= this.retries) {
                const delay = this.errors.length * Math.pow(2, this.errors.length);
                console.error(`Failed to load Google Maps script, retrying in ${delay} ms.`);
                setTimeout(() => {
                    this.deleteScript();
                    this.setScript();
                }, delay);
            }
            else {
                this.onerrorEvent = e;
                this.callback();
            }
        }
        callback() {
            this.done = true;
            this.loading = false;
            this.callbacks.forEach((cb) => {
                cb(this.onerrorEvent);
            });
            this.callbacks = [];
        }
        execute() {
            this.resetIfRetryingFailed();
            if (this.done) {
                this.callback();
            }
            else {
                // short circuit and warn if google.maps is already loaded
                if (window.google && window.google.maps && window.google.maps.version) {
                    console.warn("Google Maps already loaded outside @googlemaps/js-api-loader." +
                        "This may result in undesirable behavior as options and script parameters may not match.");
                    this.callback();
                    return;
                }
                if (this.loading) ;
                else {
                    this.loading = true;
                    this.setScript();
                }
            }
        }
    }

    class GoogleMap {
        constructor(apiKey, mapDivId, mapCenter, zoomLevel) {
            this.load = async () => {
                let loader = new Loader({
                    apiKey: this.apiKey,
                    version: "weekly",
                });
                loader.loadCallback(async (e) => {
                    if (e) {
                        console.log(e);
                        throw new Error(e.message);
                    }
                    else {
                        await this.initMap();
                    }
                });
            };
            this.apiKey = apiKey;
            this.mapDivId = mapDivId;
            this.mapCenter = mapCenter;
            this.zoomLevel = zoomLevel;
            this.strokeStart = this.strokeEnd = '';
            this.assets = new Map();
        }
        async initMap() {
            const mapDiv = document.getElementById(this.mapDivId);
            if (!mapDiv) {
                throw new Error("Html page must contain a 'map' div");
            }
            const { Map } = await google.maps.importLibrary("maps");
            this.map = new Map(mapDiv, {
                zoom: this.zoomLevel,
                center: { lat: this.mapCenter.lat, lng: this.mapCenter.lon },
                gestureHandling: 'cooperative',
                draggable: true,
                draggableCursor: 'crosshair'
            });
            this.map.data.setStyle((feature) => {
                let rend = feature.getProperty('rendering');
                if (rend) {
                    for (let i = 0; i < rend.length; i++) {
                        let shape = rend[i].shape.map(item => { return [item.x, item.y]; }).flat();
                        let marker = new google.maps.Marker({
                            map: this.map,
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8;base64,' + rend[i].svg,
                                anchor: new google.maps.Point(rend[i].anchor.x, rend[i].anchor.y)
                            },
                            shape: {
                                type: 'poly',
                                coords: shape
                            },
                            position: { lat: rend[i].position.lat, lng: rend[i].position.lon },
                        });
                        if (rend[i].title) {
                            marker.setTitle(rend[i].title);
                        }
                        marker.addListener("click", () => {
                            this.onSelection?.call(this, feature.getProperty('symbol'));
                        });
                        let poid = feature.getProperty('symbol')?.poid;
                        if (poid) {
                            if (!this.assets.has(poid)) {
                                this.assets.set(poid, [marker]);
                            }
                            else {
                                this.assets.get(poid).push(marker);
                            }
                        }
                    }
                    return { visible: feature.getGeometry().getType() != 'Point' };
                }
                return { visible: true };
            });
            this.map.data.addListener('click', (event) => {
                this.onSelection?.call(this, event.feature.getProperty('symbol'));
            });
            this.map.addListener('mousedown', (e) => {
                if (e.domEvent.ctrlKey) {
                    return false;
                }
                e.domEvent.preventDefault();
                this.enableDrawing();
                this.onStrokeStart?.call(this, new LatLon(e.latLng.lat(), e.latLng.lng()), this.getIsoTimestamp());
                this.drawFreeHand(e.latLng);
            });
        }
        drawFreeHand(latLng) {
            this.strokeStart = this.getIsoTimestamp();
            this.clearInk();
            this.strokePoly = new google.maps.Polyline({
                map: this.map,
                clickable: false,
                strokeColor: '#8B0000',
                strokeWeight: 2,
            });
            this.strokePoly.getPath().push(latLng);
            this.moveListener = google.maps.event.addListener(this.map, 'mousemove', (e) => {
                this.strokePoly.getPath().push(e.latLng);
            });
            google.maps.event.addListenerOnce(this.map, 'mouseup', (e) => {
                this.strokeEnd = this.getIsoTimestamp();
                if (this.moveListener) {
                    google.maps.event.removeListener(this.moveListener);
                }
                this.enableDragZoom();
                let path = this.strokePoly.getPath();
                if (path.getLength() == 1)
                    path.push(path.getAt(0));
                let strokeLatLng = path.getArray().map(item => { let o = new LatLon(item.lat(), item.lng()); return o; });
                let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
                let mapBounds = this.map.getBounds();
                if (!mapBounds) {
                    throw new Error("Failed to retrieve the map bounds - unable to send ink to STP");
                }
                if (this.onStrokeCompleted) {
                    this.onStrokeCompleted(new Size(sizePixels.width, sizePixels.height), new LatLon(mapBounds.getNorthEast().lat(), mapBounds.getSouthWest().lng()), new LatLon(mapBounds.getSouthWest().lat(), mapBounds.getNorthEast().lng()), strokeLatLng, this.strokeStart, this.strokeEnd, []);
                }
            });
        }
        enableDrawing() {
            this.map.setOptions({
                draggable: false,
                zoomControl: false,
                scrollwheel: false,
                disableDoubleClickZoom: false
            });
        }
        enableDragZoom() {
            this.map.setOptions({
                draggable: true,
                zoomControl: true,
                scrollwheel: true,
                disableDoubleClickZoom: true
            });
        }
        addFeature(symbolGeoJSON) {
            if (symbolGeoJSON) {
                this.map.data.addGeoJson(symbolGeoJSON);
            }
        }
        removeFeature(poid) {
            let feature = this.map.data.getFeatureById(poid);
            if (feature) {
                if (this.assets.has(poid)) {
                    let markers = this.assets.get(poid);
                    for (let i = 0; i < markers.length; i++) {
                        markers[i].setMap(null);
                    }
                }
                this.map.data.remove(feature);
            }
        }
        displayInfo(content, location, handlers) {
            let node = document.createElement('div');
            node.innerHTML = content;
            let centroid = { lat: location.lat, lng: location.lon };
            let infoWindow = new google.maps.InfoWindow({
                content: node,
                position: centroid,
            });
            if (infoWindow && handlers && handlers.length) {
                for (let i = 0; i < handlers.length; i++) {
                    let instance = node.querySelector(handlers[i].selector);
                    if (instance && handlers[i].handler) {
                        instance.addEventListener('click', (event) => {
                            if (handlers[i].closeInfo) {
                                infoWindow.close();
                            }
                            handlers[i].handler(event);
                        });
                    }
                }
            }
            infoWindow.open(this.map);
        }
        clearInk() {
            this.strokePoly?.setMap(null);
        }
        getBounds() {
            return this.map.getBounds();
        }
        getIsoTimestamp() {
            let timestamp = new Date();
            return timestamp.toISOString();
        }
    }

    let azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
    let azureServiceRegion = "<Enter Azure's subscription region>";
    let azureEndPoint = null;
    let googleMapsKey = "<Enter your Google Maps API key here>";
    let mapCenter = new LatLon(58.967774948, 11.196062412);
    let zoomLevel = 13;
    let webSocketUrl = "ws://<STP server>:<STP port>";
    window.onload = () => start();
    let stpsdk;
    let map;
    async function start() {
        const urlParams = new URLSearchParams(window.location.search);
        const mapKey = urlParams.get('mapkey');
        if (mapKey)
            googleMapsKey = mapKey;
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
        try {
            await stpsdk.connect("GoogleMapsSample", 10);
        }
        catch (error) {
            let msg = "Failed to connect to STP at " + webSocketUrl + ". \nSymbols will not be recognized. Please reload to try again";
            log(msg, StpMessageLevel.Error, true);
            return;
        }
        map = new GoogleMap(googleMapsKey, 'map', mapCenter, zoomLevel);
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
            const speechreco = new stpazurespeechBundleMinExports.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint);
            let recoResult = await speechreco.recognizeOnce();
            if (recoResult) {
                stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
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
