(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.StpWS = {}));
})(this, (function (exports) { 'use strict';

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
                    this.sessionId = await this.register();
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
                resolve(this.sessionId);
            });
        }
        register(timeout = this.DEFAULT_TIMEOUT) {
            if (!this.isConnected) {
                throw new Error('Failed to register: connection is not open (' + this.connState + ')');
            }
            this.name = this.serviceName;
            let msg = JSON.stringify({
                method: 'Register',
                params: {
                    serviceName: this.serviceName,
                    language: 'javascript',
                    solvables: this.solvables,
                    machineId: this.machineId || this.getUniqueId(9),
                    sessionId: this.sessionId
                }
            });
            return this.request(msg, timeout);
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

    exports.StpWebSocketsConnector = StpWebSocketsConnector;
    exports["default"] = StpWebSocketsConnector;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
