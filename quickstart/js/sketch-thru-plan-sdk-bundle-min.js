(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('microsoft-cognitiveservices-speech-sdk')) :
    typeof define === 'function' && define.amd ? define(['exports', 'microsoft-cognitiveservices-speech-sdk'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.StpSDK = {}, global.SpeechSDK));
}(this, (function (exports, SpeechSDK) { 'use strict';

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

    (function (StpMessageLevel) {
        StpMessageLevel["Error"] = "Error";
        StpMessageLevel["Warning"] = "Warning";
        StpMessageLevel["Info"] = "Info";
        StpMessageLevel["Debug"] = "Debug";
    })(exports.StpMessageLevel || (exports.StpMessageLevel = {}));
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
    class Sidc {
    }
    class Location {
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

    var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
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
        connect(serviceName, timeout) {
            return __awaiter(this, void 0, void 0, function* () {
                this.serviceName = serviceName;
                this.stpConnector.onInform = this.onInform.bind(this);
                this.stpConnector.onRequest = this.onRequest.bind(this);
                this.stpConnector.onError = this.onError.bind(this);
                try {
                    let solvables = this.buildSolvables();
                    return this.stpConnector.connect(this.serviceName, solvables, timeout);
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
                this.onStpMessage(error, exports.StpMessageLevel.Error);
            }
        }
        sendPenDown(location, timestamp) {
            return __awaiter(this, arguments, void 0, function* () {
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
                    this.onStpMessage(e.message, exports.StpMessageLevel.Error);
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

    var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
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
        connect(serviceName, solvables, timeout = this.DEFAULT_TIMEOUT) {
            return __awaiter$1(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => __awaiter$1(this, void 0, void 0, function* () {
                    if (this.isConnected) {
                        resolve();
                    }
                    this.serviceName = serviceName;
                    this.solvables = solvables;
                    if (timeout <= 0) {
                        timeout = this.DEFAULT_TIMEOUT;
                    }
                    try {
                        this.socket = yield this.promiseWithTimeout(timeout, this.tryConnect(this.connstring));
                        yield this.register(this.serviceName, this.solvables, this.timeout);
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
                    this.socket.onclose = (ev) => __awaiter$1(this, void 0, void 0, function* () {
                        if (!this.isConnecting) {
                            try {
                                yield this.connect(this.serviceName, this.solvables, this.timeout);
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
        register(serviceName, solvables, timeout = this.DEFAULT_TIMEOUT) {
            if (!this.isConnected) {
                throw new Error('Failed to register: connection is not open (' + this.connState + ')');
            }
            return this.promiseWithTimeout(timeout, new Promise((resolve, reject) => __awaiter$1(this, void 0, void 0, function* () {
                if (!this.socket) {
                    return;
                }
                this.name = serviceName;
                this.socket.send(JSON.stringify({
                    method: 'Register',
                    params: {
                        serviceName: this.name,
                        language: 'javascript',
                        solvables: solvables,
                        machineId: this.getUniqueId(9)
                    }
                }));
                resolve();
            })));
        }
        disconnect(timeout = this.DEFAULT_TIMEOUT) {
            return this.promiseWithTimeout(timeout, new Promise((resolve, reject) => __awaiter$1(this, void 0, void 0, function* () {
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
            return this.promiseWithTimeout(timeout, new Promise((resolve, reject) => __awaiter$1(this, void 0, void 0, function* () {
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

    var __awaiter$2 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    class AzureSpeechRecognizer {
        constructor(speechSubscriptionKey, serviceRegion, endPoint, audioConfig) {
            this.speechSubscriptionKey = speechSubscriptionKey;
            this.serviceRegion = serviceRegion;
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(this.speechSubscriptionKey, this.serviceRegion);
            speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
            if (endPoint) {
                speechConfig.endpointId = endPoint;
            }
            this.audioConfig = audioConfig
                ? audioConfig
                : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
            this.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, this.audioConfig);
        }
        recognize(maxRetries) {
            const delay = 250;
            if (!maxRetries) {
                maxRetries = 2000 / delay;
            }
            return new Promise((resolve, reject) => __awaiter$2(this, void 0, void 0, function* () {
                for (let i = 0; i < maxRetries; i++) {
                    const recoStart = new Date();
                    try {
                        const recoResult = yield this.recoOnce(recoStart);
                        resolve(recoResult);
                        return;
                    }
                    catch (e) {
                    }
                    if (i < maxRetries - 1) {
                        yield new Promise((resolve) => setTimeout(resolve, delay));
                    }
                }
                reject(new Error('Failed to recognize speech - is a microphone available and enabled?'));
            }));
        }
        recoOnce(recoStart) {
            return new Promise((resolve, reject) => {
                this.recognizer.recognizeOnceAsync((result) => {
                    switch (result.reason) {
                        case SpeechSDK.ResultReason.RecognizedSpeech:
                            let recoResult = new SpeechRecoResult();
                            recoResult.startTime = this.addTicksToDate(recoStart, result.offset);
                            recoResult.endTime = this.addTicksToDate(recoResult.startTime, result.duration);
                            let jsonDetails = result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
                            let detailedProperties = Object.assign(new AzureSpeechDetailedResults(), JSON.parse(jsonDetails));
                            const basicConversion = detailedProperties.NBest.map((item) => new SpeechRecoItem(item.Lexical, item.Confidence));
                            recoResult.results = Array.from(basicConversion);
                            for (let i = 0; i < basicConversion.length; i++) {
                                const item = basicConversion[i];
                                if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z]$/) >= 0) {
                                    const acronym = item.text.replace(/\s/g, '');
                                    const conf = item.confidence * 0.9;
                                    recoResult.results.push(new SpeechRecoItem(acronym, conf));
                                }
                            }
                            resolve(recoResult);
                            break;
                        case SpeechSDK.ResultReason.NoMatch:
                            resolve(null);
                            break;
                        case SpeechSDK.ResultReason.Canceled:
                            var cancellation = SpeechSDK.CancellationDetails.fromResult(result);
                            reject(new Error(SpeechSDK.CancellationReason[cancellation.reason]));
                            break;
                    }
                }, (error) => {
                    reject(new Error(error));
                });
            });
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

    exports.AzureSpeechRecognizer = AzureSpeechRecognizer;
    exports.Interval = Interval;
    exports.LatLon = LatLon;
    exports.Location = Location;
    exports.Sidc = Sidc;
    exports.Size = Size;
    exports.StpItem = StpItem;
    exports.StpRecognizer = StpRecognizer;
    exports.StpSymbol = StpSymbol;
    exports.StpWebSocketsConnector = StpWebSocketsConnector;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
