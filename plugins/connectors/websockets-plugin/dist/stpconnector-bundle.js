(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.StpWS = {}));
}(this, (function (exports) { 'use strict';

    var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
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
        }
        get isConnected() {
            return this.socket && this.socket.readyState === this.socket.OPEN;
        }
        get isConnecting() {
            return this.socket && this.socket.readyState === this.socket.CONNECTING;
        }
        get connState() {
            return this.socket ? this.socket.readyState.toString() : '';
        }
        connect(serviceName, solvables, timeout) {
            return __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    if (this.isConnected) {
                        resolve();
                    }
                    this.serviceName = serviceName;
                    this.solvables = solvables;
                    this.timeout = timeout;
                    try {
                        this.socket = yield this.promiseWithTimeout(this.tryConnect(this.connstring));
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
                    this.socket.onclose = (ev) => __awaiter(this, void 0, void 0, function* () {
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
        register(serviceName, solvables, timeout) {
            if (!this.isConnected) {
                throw new Error('Failed to register: connection is not open (' + this.connState + ')');
            }
            return this.promiseWithTimeout(new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this.baseName = serviceName;
                this.name = this.baseName + '_' + this.uniqueId(9);
                this.socket.send(JSON.stringify({
                    method: 'Register',
                    params: {
                        serviceName: this.name,
                        language: 'javascript',
                        solvables: solvables.join()
                    }
                }));
                resolve();
            })), timeout);
        }
        disconnect(timeout) {
            return this.promiseWithTimeout(new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (!this.isConnected) {
                    this.socket.close();
                }
                resolve();
            })), timeout);
        }
        inform(message, timeout) {
            if (!this.isConnected) {
                throw new Error('Failed to send message: connection is not open (' +
                    this.connState +
                    ')');
            }
            return this.promiseWithTimeout(new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this.socket.send(message);
                resolve();
            })), timeout);
        }
        request(message, timeout) {
            throw new Error('Method not implemented');
        }
        tryConnect(connstring) {
            return new Promise((resolve, reject) => {
                var socket = new WebSocket(connstring);
                socket.onopen = () => resolve(socket);
                socket.onerror = (err) => reject(new Error('Unspecified error communicating with STP'));
            });
        }
        promiseWithTimeout(promise, timeout) {
            if (!timeout)
                timeout = this.DEFAULT_TIMEOUT;
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
        uniqueId(numChars) {
            if (!numChars)
                numChars = 9;
            return Math.random().toString(36).substr(2, numChars);
        }
    }

    exports.StpWebSocketsConnector = StpWebSocketsConnector;
    exports.default = StpWebSocketsConnector;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
