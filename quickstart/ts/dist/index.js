(function (require$$0) {
	'use strict';

	function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

	var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, basedir, module) {
		return module = {
			path: basedir,
			exports: {},
			require: function (path, base) {
				return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
			}
		}, fn(module, module.exports), module.exports;
	}

	function commonjsRequire () {
		throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
	}

	var sketchThruPlanSdkBundleMin = createCommonjsModule(function (module, exports) {
	!function(t,e){e(exports);}(commonjsGlobal,(function(t){function e(t,i){let n,s=t&&t.type;if("FeatureCollection"===s){let o=t;for(n=0;n<o.features.length;n++)e(o.features[n],i);}else if("GeometryCollection"===s){let o=t;for(n=0;n<o.geometries.length;n++)e(o.geometries[n],i);}else if("Feature"===s){e(t.geometry,i);}else if("Polygon"===s){o(t.coordinates,i);}else if("MultiPolygon"===s){let e=t;for(n=0;n<e.coordinates.length;n++)o(e.coordinates[n],i);}return t}function o(t,e){if(0!==t.length){i(t[0],e);for(let o=1;o<t.length;o++)i(t[o],!e);}}function i(t,e){let o=0;for(let e=0,i=t.length,n=i-1;e<i;n=e++)o+=(t[e][0]-t[n][0])*(t[n][1]+t[e][1]);o>=0!=!!e&&t.reverse();}var n;(n=t.StpMessageLevel||(t.StpMessageLevel={})).Error="Error",n.Warning="Warning",n.Info="Info",n.Debug="Debug";class s{}class r extends s{asGeoJSON(){var t,o,i,n,s,r;if(null==this.location||null==this.location.coords||0==(null===(t=this.location)||void 0===t?void 0:t.coords.length))throw new Error("Coordinates are undefined or empty");let h;if("point"===(null===(o=this.location)||void 0===o?void 0:o.fsTYPE))h={type:"Point",coordinates:[this.location.coords[0].lon,this.location.coords[0].lat]};else if("line"===(null===(i=this.location)||void 0===i?void 0:i.fsTYPE))h={type:"LineString",coordinates:this.location.coords.map((t=>[t.lon,t.lat]))};else if("area"===(null===(n=this.location)||void 0===n?void 0:n.fsTYPE))h={type:"Polygon",coordinates:[this.location.coords.map((t=>[t.lon,t.lat]))]},h=e(h,!1);else {if("multipoint"!==(null===(s=this.location)||void 0===s?void 0:s.fsTYPE))throw new Error('Expected "point", "line", "area", or "multipoint" geometry type. Got: '+(null===(r=this.location)||void 0===r?void 0:r.fsTYPE));h={type:"MultiPoint",coordinates:this.location.coords.map((t=>[t.lon,t.lat]))};}return {type:"Feature",id:this.poid,geometry:h,properties:{symbol:this}}}}var h=function(t,e,o,i){return new(o||(o=Promise))((function(n,s){function r(t){try{c(i.next(t));}catch(t){s(t);}}function h(t){try{c(i.throw(t));}catch(t){s(t);}}function c(t){var e;t.done?n(t.value):(e=t.value,e instanceof o?e:new o((function(t){t(e);}))).then(r,h);}c((i=i.apply(t,e||[])).next());}))};var c=function(t,e,o,i){return new(o||(o=Promise))((function(n,s){function r(t){try{c(i.next(t));}catch(t){s(t);}}function h(t){try{c(i.throw(t));}catch(t){s(t);}}function c(t){var e;t.done?n(t.value):(e=t.value,e instanceof o?e:new o((function(t){t(e);}))).then(r,h);}c((i=i.apply(t,e||[])).next());}))};t.Interval=class{constructor(t,e){this.start=t,this.end=e;}equals(t){return this.start==t.start&&this.end==t.end}},t.LatLon=class{constructor(t,e){this.lat=t,this.lon=e;}equals(t){return this.lat==t.lat&&this.lon==t.lon}},t.Location=class{},t.Sidc=class{},t.Size=class{constructor(t,e){this.width=t,this.height=e;}equals(t){return this.width==t.width&&this.height==t.height}},t.StpItem=s,t.StpRecognizer=class{constructor(t){this.stpConnector=t,this.serviceName="";}connect(t,e){return h(this,void 0,void 0,(function*(){this.serviceName=t,this.stpConnector.onInform=this.onInform.bind(this),this.stpConnector.onRequest=this.onRequest.bind(this),this.stpConnector.onError=this.onError.bind(this);try{let t=this.buildSolvables();return this.stpConnector.connect(this.serviceName,t,e)}catch(t){throw t}}))}buildSolvables(){return Object.getOwnPropertyNames(this).filter((t=>t.toString().startsWith("on")&&"function"==typeof this[t])).map((t=>t.substring(2)))}onInform(t){let e=JSON.parse(t);this.handleInform(e);}onRequest(t){return this.onInform(t),[]}onError(e){this.onStpMessage&&this.onStpMessage(e,t.StpMessageLevel.Error);}sendPenDown(t,e){return h(this,arguments,void 0,(function*(){this.informStp("SendPenDown",{location:arguments[0],timestamp:arguments[1]});}))}sendInk(t,e,o,i,n,s,r){this.informStp("SendInk",{pixelBoundsWindow:arguments[0],topLeftGeoMap:arguments[1],bottomRightGeoMap:arguments[2],strokePoints:arguments[3],timeStrokeStart:arguments[4],timeStrokeEnd:arguments[5],intersectedPoids:arguments[6]});}sendSpeechRecognition(t,e,o){this.informStp("SendSpeechRecognition",{recoList:arguments[0],startTime:arguments[1],endTime:arguments[2]});}addSymbol(t){this.informStp("AddSymbol",{symbol:arguments[0]});}updateSymbol(t,e){this.informStp("UpdateSymbol",{poid:arguments[0],symbol:arguments[1]});}deleteSymbol(t){this.informStp("DeleteSymbol",{poid:arguments[0]});}chooseAlternate(t,e){this.informStp("ChooseAlternate",{poid:arguments[0],nBestIndex:arguments[1]});}informStp(e,o){try{let t={method:e,params:o};this.stpConnector.inform(JSON.stringify(t));}catch(e){this.onStpMessage&&this.onStpMessage(e.message,t.StpMessageLevel.Error);}}handleInform(t){if("SymbolAdded"===t.method&&this.onSymbolAdded){const e=t.params;let o=[];for(let t=0;t<e.alternates.length;t++){const i=Object.assign(new r,e.alternates[t]);o.push(i);}this.onSymbolAdded(o,e.isUndo);}else if("SymbolModified"===t.method&&this.onSymbolModified){const e=t.params,o=Object.assign(new r,e.symbol);this.onSymbolModified(e.poid,o,e.isUndo);}else if("SymbolDeleted"===t.method&&this.onSymbolDeleted){const e=t.params;this.onSymbolDeleted(e.poid,e.isUndo);}else if("InkProcessed"===t.method&&this.onInkProcessed)this.onInkProcessed();else if("SpeechRecognized"===t.method&&this.onSpeechRecognized){const e=t.params;this.onSpeechRecognized(e.phrases);}else if("StpMessage"===t.method&&this.onStpMessage){const e=t.params;this.onStpMessage(e.message,e.level);}else console.log("Received message with no handler: "+t.method);}},t.StpSymbol=r,t.StpWebSocketsConnector=class{constructor(t){this.DEFAULT_TIMEOUT=30,this.connstring=t,this.socket=null;}get isConnected(){return null!=this.socket&&this.socket.readyState===this.socket.OPEN}get isConnecting(){return null!=this.socket&&this.socket.readyState===this.socket.CONNECTING}get connState(){return this.socket?this.socket.readyState.toString():""}connect(t,e,o=this.DEFAULT_TIMEOUT){return c(this,void 0,void 0,(function*(){return new Promise(((i,n)=>c(this,void 0,void 0,(function*(){this.isConnected&&i(),this.serviceName=t,this.solvables=e,o<=0&&(o=this.DEFAULT_TIMEOUT);try{this.socket=yield this.promiseWithTimeout(o,this.tryConnect(this.connstring)),yield this.register(this.serviceName,this.solvables,this.timeout);}catch(t){return void n(new Error("Failed to connect: "+t.message))}this.socket.onmessage=t=>{this.onInform&&this.onInform(t.data);},this.socket.onerror=t=>{this.onError&&this.onError("Error connecting to STP. Check that the service is running and refresh page to retry");},this.socket.onclose=t=>c(this,void 0,void 0,(function*(){if(!this.isConnecting)try{yield this.connect(this.serviceName,this.solvables,this.timeout);}catch(t){this.onError&&this.onError("Lost connection to STP. Check that the service is running and refresh page to retry");}})),i();}))))}))}register(t,e,o=this.DEFAULT_TIMEOUT){if(!this.isConnected)throw new Error("Failed to register: connection is not open ("+this.connState+")");return this.promiseWithTimeout(o,new Promise(((o,i)=>c(this,void 0,void 0,(function*(){this.socket&&(this.name=t,this.socket.send(JSON.stringify({method:"Register",params:{serviceName:this.name,language:"javascript",solvables:e,machineId:this.getUniqueId(9)}})),o());})))))}disconnect(t=this.DEFAULT_TIMEOUT){return this.promiseWithTimeout(t,new Promise(((t,e)=>c(this,void 0,void 0,(function*(){!this.isConnected&&this.socket&&this.socket.close(),t();})))))}inform(t,e=this.DEFAULT_TIMEOUT){if(!this.isConnected)throw new Error("Failed to send inform: connection is not open ("+this.connState+")");return this.promiseWithTimeout(e,new Promise(((e,o)=>c(this,void 0,void 0,(function*(){this.socket&&(this.socket.send(t),e());})))))}request(t,e=this.DEFAULT_TIMEOUT){throw new Error("Method not implemented")}tryConnect(t){return new Promise(((e,o)=>{var i=new WebSocket(t);i.onopen=()=>e(i),i.onerror=t=>o(new Error("Unspecified error communicating with STP"));}))}promiseWithTimeout(t,e){return Promise.race([e,new Promise(((e,o)=>{let i=setTimeout((()=>{clearTimeout(i),o(new Error("Operation timed out"));}),1e3*t);}))])}getUniqueId(t){return t||(t=9),Math.random().toString(36).substr(2,t)}},Object.defineProperty(t,"__esModule",{value:!0});}));
	});

	var stpazurespeechBundleMin = createCommonjsModule(function (module, exports) {
	var t;t=function(e,t){var i=function(e,t,i,n){return new(i||(i=Promise))((function(o,s){function r(e){try{a(n.next(e));}catch(e){s(e);}}function c(e){try{a(n.throw(e));}catch(e){s(e);}}function a(e){var t;e.done?o(e.value):(t=e.value,t instanceof i?t:new i((function(e){e(t);}))).then(r,c);}a((n=n.apply(e,t||[])).next());}))};class n{constructor(){this.results=[],this.startTime=new Date,this.endTime=new Date;}}class o{constructor(e,t){this.text=e,this.confidence=t;}}class s{constructor(){this.RecognitionStatus="",this.Offset=0,this.Duration=0,this.DisplayText="",this.NBest=[];}}e.AzureSpeechRecognizer=class{constructor(e,i,n,o){this.speechSubscriptionKey=e,this.serviceRegion=i,this.speechConfig=t.SpeechConfig.fromSubscription(this.speechSubscriptionKey,this.serviceRegion),this.speechConfig.outputFormat=t.OutputFormat.Detailed,n&&(this.speechConfig.endpointId=n),this.audioConfig=o||t.AudioConfig.fromDefaultMicrophoneInput();}recognizeOnce(e){return e||(e=8),this.recognizer=new t.SpeechRecognizer(this.speechConfig,this.audioConfig),new Promise(((t,n)=>i(this,void 0,void 0,(function*(){var i;for(let i=0;i<e;i++){this.recoStart=new Date;try{const e=yield this.tryReco(this.recoStart);return void t(e)}catch(e){}i<e-1&&(yield new Promise((e=>setTimeout(e,250))));}let o=new Error("Failed to recognize speech");null===(i=this.onError)||void 0===i||i.call(this,o),n(o);}))))}tryReco(e){return new Promise(((i,n)=>{var o;this.recognizer.recognizing=(e,t)=>{var i;null===(i=this.onRecognizing)||void 0===i||i.call(this,t.result.text);},this.recognizer.recognized=(t,n)=>{var o;let s=this.convertResults(e,n.result);null===(o=this.onRecognized)||void 0===o||o.call(this,s),i(s);},this.recognizer.canceled=(e,i)=>{n(new Error(t.CancellationReason[i.reason]));},null===(o=this.recognizer)||void 0===o||o.recognizeOnceAsync();}))}startRecognizing(){this.recognizer=new t.SpeechRecognizer(this.speechConfig,this.audioConfig),this.recoStart=new Date,this.recognizer.recognizing=(e,t)=>{var i;null===(i=this.onRecognizing)||void 0===i||i.call(this,t.result.text);},this.recognizer.recognized=(e,t)=>{var i;let n=this.convertResults(this.recoStart,t.result);null===(i=this.onRecognized)||void 0===i||i.call(this,n);},this.recognizer.canceled=(e,i)=>{var n;let o=new Error(t.CancellationReason[i.reason]);this.onError?this.onError.call(this,o):null===(n=this.onRecognized)||void 0===n||n.call(this,null);},this.recognizer.startContinuousRecognitionAsync();}stopRecognizing(e){this.recognizer&&setTimeout((()=>{var e;null===(e=this.recognizer)||void 0===e||e.close(),this.recognizer=void 0;}),e||0);}convertResults(e,i){if(i.reason===t.ResultReason.NoMatch)return null;let r=new n;r.startTime=this.addTicksToDate(e,i.offset),r.endTime=this.addTicksToDate(r.startTime,i.duration);let c=i.properties.getProperty(t.PropertyId.SpeechServiceResponse_JsonResult);const a=Object.assign(new s,JSON.parse(c)).NBest.map((e=>new o(e.Lexical,e.Confidence)));let h=Array.from(a);for(let e=0;e<a.length;e++){const t=a[e];if(t.text.search(/^([a-zA-Z]\s)+[a-zA-Z]$/)>=0){const e=t.text.replace(/\s/g,""),i=.9*t.confidence;h.push(new o(e,i));}else if(t.text.search(/^([a-zA-Z]\s)+[a-zA-Z]+$/)>=0){let e=t.text.match(/^(([a-zA-Z]\s)+)([a-zA-Z]+)$/);if(e&&4==e.length){const i=e[1].replace(/\s/g,""),n=e[3],s=.7*t.confidence;h.push(new o(i+" "+n,s));}}}return r.results=h.sort(((e,t)=>t.confidence-e.confidence)),r}addTicksToDate(e,t){let i=1e4*e.getTime()+621355968e9;return new Date((i+t-621355968e9)/1e4)}},Object.defineProperty(e,"__esModule",{value:!0});},t(exports,require$$0__default['default']);
	});

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
	        var _a;
	        if (((_a = this.symbol.location) === null || _a === void 0 ? void 0 : _a.fsTYPE) == 'point') {
	            let gsvg = [this.pointSVG(this.symbol)];
	            return gsvg;
	        }
	        else {
	            return null;
	        }
	    }
	    getGestureGeometry(symbol) {
	        var _a, _b, _c, _d, _e, _f, _g;
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
	            if (((_a = symbol.location) === null || _a === void 0 ? void 0 : _a.shape) != null && ((_b = symbol.location) === null || _b === void 0 ? void 0 : _b.shape.includes("arrowfat"))) {
	                let reorderedLatLon = symbol.location.coords.slice(0, symbol.location.coords.length - 1).reverse();
	                reorderedLatLon.push(symbol.location.coords[symbol.location.coords.length - 1]);
	                res = this.toLineString(reorderedLatLon);
	            }
	            else if (((_c = symbol.location) === null || _c === void 0 ? void 0 : _c.shape) == "ubend") {
	                let reorderedLatLon = [symbol.location.coords[0], symbol.location.coords[2], symbol.location.coords[3], symbol.location.coords[1]];
	                res = this.toLineString(reorderedLatLon);
	            }
	            else if (((_d = symbol.location) === null || _d === void 0 ? void 0 : _d.shape) == "ubendthreepoints") {
	                let fourthPt = new sketchThruPlanSdkBundleMin.LatLon(symbol.location.coords[1].lat, symbol.location.coords[2].lon);
	                let reorderedLatLon = [symbol.location.coords[0], symbol.location.coords[2], fourthPt, symbol.location.coords[1]];
	                res = this.toLineString(reorderedLatLon);
	            }
	            else if (((_e = symbol.location) === null || _e === void 0 ? void 0 : _e.shape) == "vee") {
	                let reorderedLatLon = [symbol.location.coords[1], symbol.location.coords[0], symbol.location.coords[2]];
	                res = this.toLineString(reorderedLatLon);
	            }
	            else if (((_f = symbol.location) === null || _f === void 0 ? void 0 : _f.shape) == "opencircle") ;
	            else if (((_g = symbol.location) === null || _g === void 0 ? void 0 : _g.shape) == "multipoint") {
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
	        let matrix = svgEl === null || svgEl === void 0 ? void 0 : svgEl.getCTM();
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

	var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
	    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
	    return new (P || (P = Promise))(function (resolve, reject) {
	        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
	        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
	        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
	        step((generator = generator.apply(thisArg, _arguments || [])).next());
	    });
	};
	class GoogleMap {
	    constructor(apiKey, mapDivId, mapCenter, zoomLevel) {
	        this.apiKey = apiKey;
	        this.mapDivId = mapDivId;
	        this.mapCenter = mapCenter;
	        this.zoomLevel = zoomLevel;
	        this.strokeStart = this.strokeEnd = '';
	        this.assets = new Map();
	    }
	    load() {
	        return __awaiter(this, void 0, void 0, function* () {
	            const googleMapsUrl = "https://maps.googleapis.com/maps/api/js?key=" + this.apiKey;
	            if (!document.querySelectorAll('[src="' + googleMapsUrl + '"]').length) {
	                document.body.appendChild(Object.assign(document.createElement('script'), {
	                    type: 'text/javascript',
	                    src: googleMapsUrl,
	                    onload: () => __awaiter(this, void 0, void 0, function* () { return yield this.initMap(); })
	                }));
	            }
	            else {
	                yield this.initMap();
	            }
	        });
	    }
	    initMap() {
	        return __awaiter(this, void 0, void 0, function* () {
	            const mapDiv = document.getElementById(this.mapDivId);
	            if (!mapDiv) {
	                throw new Error("Html page must contain a 'map' div");
	            }
	            this.map = new google.maps.Map(mapDiv, {
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
	                            var _a;
	                            (_a = this.onSelection) === null || _a === void 0 ? void 0 : _a.call(this, feature.getProperty('symbol'));
	                        });
	                        let poid = feature.getProperty('symbol').poid;
	                        if (!this.assets.has(poid)) {
	                            this.assets.set(poid, [marker]);
	                        }
	                        else {
	                            this.assets.get(poid).push(marker);
	                        }
	                    }
	                    return { visible: feature.getGeometry().getType() != 'Point' };
	                }
	                return { visible: true };
	            });
	            this.map.data.addListener('click', (event) => {
	                var _a;
	                (_a = this.onSelection) === null || _a === void 0 ? void 0 : _a.call(this, event.feature.getProperty('symbol'));
	            });
	            this.map.addListener('mousedown', (e) => {
	                var _a;
	                if (e.domEvent.ctrlKey) {
	                    return false;
	                }
	                e.domEvent.preventDefault();
	                this.enableDrawing();
	                (_a = this.onStrokeStart) === null || _a === void 0 ? void 0 : _a.call(this, new sketchThruPlanSdkBundleMin.LatLon(e.latLng.lat(), e.latLng.lng()), this.getIsoTimestamp());
	                this.drawFreeHand(e.latLng);
	            });
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
	            let strokeLatLng = path.getArray().map(item => { let o = new sketchThruPlanSdkBundleMin.LatLon(item.lat(), item.lng()); return o; });
	            let sizePixels = { width: document.getElementById('map').clientWidth, height: document.getElementById('map').clientHeight };
	            let mapBounds = this.map.getBounds();
	            if (!mapBounds) {
	                throw new Error("Failed to retrieve the map bounds - unable to send ink to STP");
	            }
	            if (this.onStrokeCompleted) {
	                this.onStrokeCompleted(new sketchThruPlanSdkBundleMin.Size(sizePixels.width, sizePixels.height), new sketchThruPlanSdkBundleMin.LatLon(mapBounds.getNorthEast().lat(), mapBounds.getSouthWest().lng()), new sketchThruPlanSdkBundleMin.LatLon(mapBounds.getSouthWest().lat(), mapBounds.getNorthEast().lng()), strokeLatLng, this.strokeStart, this.strokeEnd, []);
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
	                    google.maps.event.addDomListener(instance, 'click', (event) => {
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
	        var _a;
	        (_a = this.strokePoly) === null || _a === void 0 ? void 0 : _a.setMap(null);
	    }
	    getBounds() {
	        return this.map.getBounds();
	    }
	    getIsoTimestamp() {
	        let timestamp = new Date();
	        return timestamp.toISOString();
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
	let azureSubscriptionKey = "<Enter your Azure Speech subscription key here>";
	let azureServiceRegion = "<Enter Azure's subscription region>";
	let azureEndPoint = null;
	let googleMapsKey = "<Enter your Google Maps API key here>";
	let mapCenter = new sketchThruPlanSdkBundleMin.LatLon(58.967774948, 11.196062412);
	let zoomLevel = 13;
	let webSocketUrl = "ws://<STP server>:<STP port>";
	window.onload = () => start();
	let stpsdk;
	let map;
	function start() {
	    return __awaiter$1(this, void 0, void 0, function* () {
	        const urlParams = new URLSearchParams(window.location.search);
	        const mapKey = urlParams.get('mapkey');
	        if (mapKey)
	            googleMapsKey = mapKey;
	        const latParm = urlParams.get('lat');
	        const lonParm = urlParams.get('lon');
	        if (latParm && lonParm)
	            mapCenter = new sketchThruPlanSdkBundleMin.LatLon(parseFloat(latParm), parseFloat(lonParm));
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
	        const stpconn = new sketchThruPlanSdkBundleMin.StpWebSocketsConnector(webSocketUrl);
	        stpsdk = new sketchThruPlanSdkBundleMin.StpRecognizer(stpconn);
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
	            yield stpsdk.connect("GoogleMapsSample", 10);
	        }
	        catch (error) {
	            let msg = "Failed to connect to STP at " + webSocketUrl + ". \nSymbols will not be recognized. Please reload to try again";
	            log(msg, sketchThruPlanSdkBundleMin.StpMessageLevel.Error, true);
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
	                    { selector: '#delButton', handler: (event) => {
	                            stpsdk.deleteSymbol(symbol.poid);
	                        }, closeInfo: true }
	                ]);
	            }
	        };
	        map.load();
	    });
	}
	function recognizeSpeech() {
	    return __awaiter$1(this, void 0, void 0, function* () {
	        try {
	            const speechreco = new stpazurespeechBundleMin.AzureSpeechRecognizer(azureSubscriptionKey, azureServiceRegion, azureEndPoint);
	            let recoResult = yield speechreco.recognizeOnce();
	            if (recoResult) {
	                stpsdk.sendSpeechRecognition(recoResult.results, recoResult.startTime, recoResult.endTime);
	                if (recoResult.results && recoResult.results.length > 0) {
	                    log(recoResult.results[0].text);
	                }
	            }
	        }
	        catch (e) {
	            let msg = "Failed to process speech: " + e.message;
	            log(msg), true;
	        }
	    });
	}
	function buildInfo(symbol) {
	    var _a, _b, _c, _d;
	    if (!symbol || !symbol.location || !symbol.location.centroid) {
	        return null;
	    }
	    let contentString = '<h3 id="firstHeading" class="firstHeading">' + symbol.fullDescription + '</h3>' +
	        '<table>' +
	        '<tr>' +
	        '<td>2525D PartA</td><td>' + ((_a = symbol.sidc) === null || _a === void 0 ? void 0 : _a.partA) + '</td>' +
	        '</tr>' +
	        '<tr>' +
	        '<td>2525D PartB</td><td>' + ((_b = symbol.sidc) === null || _b === void 0 ? void 0 : _b.partB) + '</td>' +
	        '</tr>' +
	        '<tr>' +
	        '<td>Symbol Set</td><td>' + ((_c = symbol.sidc) === null || _c === void 0 ? void 0 : _c.symbolSet) + '</td>' +
	        '</tr>' +
	        '<tr>' +
	        '<td>2525C SIDC</td><td>' + ((_d = symbol.sidc) === null || _d === void 0 ? void 0 : _d.legacy) + '</td>' +
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

}(SpeechSDK));
