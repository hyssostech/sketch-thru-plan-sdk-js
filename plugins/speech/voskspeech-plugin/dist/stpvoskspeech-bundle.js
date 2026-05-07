(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('vosk-browser')) :
    typeof define === 'function' && define.amd ? define(['exports', 'vosk-browser'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.StpVS = {}, global.Vosk));
})(this, (function (exports, voskBrowser) { 'use strict';

    class VoskSpeechRecognizer {
        constructor(modelPath, sampleRate, workletPath) {
            this._model = null;
            this._recognizer = null;
            this._modelLoaded = false;
            this._modelError = null;
            this._audioContext = null;
            this._mediaStream = null;
            this._sourceNode = null;
            this._processorNode = null;
            this._workletRegistered = false;
            this._isListening = false;
            this._recoStart = new Date();
            this.onModelReady = null;
            this._pendingResults = [];
            this._graceTimer = null;
            this._gracePeriodMs = 1500;
            this._lastPartial = '';
            this._modelPath = modelPath ?? './model';
            this._sampleRate = sampleRate ?? 16000;
            this._workletPath = workletPath ?? 'vosk-processor.js';
            this._modelReady = this.initializeModel();
        }
        async initializeModel() {
            try {
                const absoluteModelUrl = new URL(this._modelPath, window.location.href).href;
                const manifestUrl = absoluteModelUrl.replace(/\/$/, '') + '/manifest.json';
                const probe = await fetch(manifestUrl, { method: 'HEAD' });
                if (!probe.ok) {
                    throw new Error(`Model not found at '${this._modelPath}'. ` +
                        `Extract vosk-model-la-domain.zip into that directory — see the plugin README for instructions.`);
                }
                this._model = await voskBrowser.createModel(absoluteModelUrl, -1);
                this._model.setLogLevel(-1);
                this._modelLoaded = true;
                this.onModelReady?.call(this);
            }
            catch (e) {
                this._modelError = new Error(`Failed to load Vosk model from '${this._modelPath}': ${e.message || e}`);
                this.onError?.call(this, this._modelError);
            }
        }
        async ensureModelReady() {
            await this._modelReady;
            if (this._modelError) {
                throw this._modelError;
            }
        }
        async recognizeOnce(maxRetries) {
            const delay = 250;
            if (!maxRetries) {
                maxRetries = 2000 / delay;
            }
            for (let i = 0; i < maxRetries; i++) {
                try {
                    const result = await this.tryRecoOnce();
                    return result;
                }
                catch (e) {
                }
                if (i < maxRetries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
            const err = new Error('Failed to recognize speech');
            this.onError?.call(this, err);
            throw err;
        }
        async tryRecoOnce() {
            return new Promise(async (resolve, reject) => {
                const originalOnRecognized = this.onRecognized;
                this.onRecognized = (result) => {
                    this.onRecognized = originalOnRecognized;
                    this.stopRecognizing();
                    resolve(result);
                };
                try {
                    this.startRecognizing();
                    setTimeout(() => {
                        this.onRecognized = originalOnRecognized;
                        this.stopRecognizing();
                        resolve(null);
                    }, 10000);
                }
                catch (e) {
                    this.onRecognized = originalOnRecognized;
                    reject(e);
                }
            });
        }
        startRecognizing() {
            if (this._isListening) {
                return;
            }
            this._isListening = true;
            this._recoStart = new Date();
            this._pendingResults = [];
            this.startRecognizingAsync().catch((e) => {
                this._isListening = false;
                this.onError?.call(this, e instanceof Error ? e : new Error(String(e)));
            });
        }
        async startRecognizingAsync() {
            await this.ensureModelReady();
            const RecognizerClass = this._model.KaldiRecognizer;
            this._recognizer = new RecognizerClass(this._sampleRate);
            this._recognizer.setWords(true);
            this._recognizer.on('result', (message) => {
                this.handleResult(message);
            });
            this._recognizer.on('partialresult', (message) => {
                this.handlePartialResult(message);
            });
            this._recognizer.on('error', (message) => {
                this.onError?.call(this, new Error(`Vosk recognition error: ${message.error || message}`));
            });
            await this.startAudioCapture();
        }
        stopRecognizing(wait) {
            if (wait && wait > 0) {
                setTimeout(() => this.finalizeAndTeardown(), wait);
            }
            else {
                this.finalizeAndTeardown();
            }
        }
        finalizeAndTeardown() {
            this._isListening = false;
            if (this._recognizer) {
                const timeoutId = setTimeout(() => {
                    this.flushPendingResults();
                    this.cleanupResources();
                }, 1000);
                const onFinal = (_message) => {
                    clearTimeout(timeoutId);
                    setTimeout(() => {
                        this.flushPendingResults();
                        this.cleanupResources();
                    }, 0);
                };
                this._recognizer.on('result', onFinal);
                this._recognizer.retrieveFinalResult();
            }
            else {
                this.flushPendingResults();
                this.cleanupResources();
            }
        }
        async startAudioCapture() {
            this._mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: this._sampleRate,
                },
            });
            this._audioContext = new AudioContext({ sampleRate: this._sampleRate });
            if (!this._workletRegistered) {
                await this._audioContext.audioWorklet.addModule(this._workletPath);
                this._workletRegistered = true;
            }
            this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream);
            this._processorNode = new AudioWorkletNode(this._audioContext, 'vosk-processor');
            this._processorNode.port.onmessage = (event) => {
                if (this._recognizer && this._isListening) {
                    const audioData = event.data;
                    this._recognizer.acceptWaveformFloat(audioData, this._audioContext.sampleRate);
                }
            };
            this._sourceNode.connect(this._processorNode);
            this._processorNode.connect(this._audioContext.destination);
        }
        cleanupResources() {
            if (this._processorNode) {
                this._processorNode.disconnect();
                this._processorNode = null;
            }
            if (this._sourceNode) {
                this._sourceNode.disconnect();
                this._sourceNode = null;
            }
            if (this._mediaStream) {
                this._mediaStream.getTracks().forEach((t) => t.stop());
                this._mediaStream = null;
            }
            if (this._audioContext) {
                this._audioContext.close();
                this._audioContext = null;
                this._workletRegistered = false;
            }
            if (this._recognizer) {
                this._recognizer.remove();
                this._recognizer = null;
            }
            this._lastPartial = '';
        }
        handleResult(message) {
            const text = message.result?.text;
            if (!text || text.trim().length === 0) {
                return;
            }
            const recoResult = this.convertResult(message);
            if (!recoResult) {
                return;
            }
            this._pendingResults.push(recoResult);
            if (this._graceTimer) {
                clearTimeout(this._graceTimer);
            }
            this._graceTimer = setTimeout(() => {
                this.flushPendingResults();
            }, this._gracePeriodMs);
        }
        handlePartialResult(message) {
            const partial = message.result?.partial;
            if (partial && partial.trim().length > 0 && partial !== this._lastPartial) {
                this._lastPartial = partial;
                this.onRecognizing?.call(this, partial);
            }
        }
        convertResult(message) {
            const text = message.result?.text?.trim();
            if (!text || text.length === 0) {
                return null;
            }
            const words = message.result?.result;
            const recoResult = new SpeechRecoResult();
            if (words && words.length > 0) {
                recoResult.startTime = this.addSecondsToDate(this._recoStart, words[0].start);
                recoResult.endTime = this.addSecondsToDate(this._recoStart, words[words.length - 1].end);
                const logSum = words.reduce((sum, w) => sum + Math.log(Math.max(w.conf, 1e-10)), 0);
                const confidence = Math.exp(logSum / words.length);
                recoResult.results.push(new SpeechRecoItem(text, confidence));
                const compacted = this.spelledLettersToAcronym(text);
                if (compacted !== null) {
                    recoResult.results.push(new SpeechRecoItem(compacted, confidence * 0.9));
                }
            }
            else {
                recoResult.startTime = this._recoStart;
                recoResult.endTime = new Date();
                recoResult.results.push(new SpeechRecoItem(text, 0.5));
            }
            return recoResult;
        }
        flushPendingResults() {
            if (this._graceTimer) {
                clearTimeout(this._graceTimer);
                this._graceTimer = null;
            }
            const segments = this._pendingResults.splice(0);
            if (segments.length === 0) {
                return;
            }
            const merged = new SpeechRecoResult();
            merged.results = segments
                .flatMap((s) => s.results)
                .sort((a, b) => b.confidence - a.confidence);
            merged.startTime = segments[0].startTime;
            merged.endTime = segments[segments.length - 1].endTime;
            this.onRecognized?.call(this, merged);
        }
        spelledLettersToAcronym(text) {
            const pattern = /\b([a-zA-Z]\s)+[a-zA-Z]\b/g;
            if (!pattern.test(text)) {
                return null;
            }
            pattern.lastIndex = 0;
            const compacted = text.replace(pattern, (match) => {
                return match.replace(/\s/g, '');
            });
            return compacted !== text ? compacted : null;
        }
        addSecondsToDate(date, seconds) {
            return new Date(date.getTime() + seconds * 1000);
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

    exports.VoskSpeechRecognizer = VoskSpeechRecognizer;

}));
