var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
export class AzureSpeechRecognizer {
    constructor(speechSubscriptionKey, serviceRegion, endPoint, audioConfig) {
        this.speechSubscriptionKey = speechSubscriptionKey;
        this.serviceRegion = serviceRegion;
        this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(this.speechSubscriptionKey, this.serviceRegion);
        this.speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
        if (endPoint) {
            this.speechConfig.endpointId = endPoint;
        }
        this.audioConfig = audioConfig
            ? audioConfig
            : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    }
    recognizeOnce(maxRetries) {
        const delay = 250;
        if (!maxRetries) {
            maxRetries = 2000 / delay;
        }
        this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig);
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            for (let i = 0; i < maxRetries; i++) {
                this.recoStart = new Date();
                try {
                    const recoResult = yield this.tryReco(this.recoStart);
                    resolve(recoResult);
                    return;
                }
                catch (e) {
                }
                if (i < maxRetries - 1) {
                    yield new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
            let err = new Error('Failed to recognize speech');
            (_a = this.onError) === null || _a === void 0 ? void 0 : _a.call(this, err);
            reject(err);
        }));
    }
    tryReco(recoStart) {
        return new Promise((resolve, reject) => {
            var _a;
            this.recognizer.recognizing = (s, e) => {
                var _a;
                (_a = this.onRecognizing) === null || _a === void 0 ? void 0 : _a.call(this, e.result.text);
            };
            this.recognizer.recognized = (s, e) => {
                var _a;
                let recoResult = this.convertResults(recoStart, e.result);
                (_a = this.onRecognized) === null || _a === void 0 ? void 0 : _a.call(this, recoResult);
                resolve(recoResult);
            };
            this.recognizer.canceled = (s, e) => {
                reject(new Error(SpeechSDK.CancellationReason[e.reason]));
            };
            (_a = this.recognizer) === null || _a === void 0 ? void 0 : _a.recognizeOnceAsync();
        });
    }
    startRecognizing() {
        this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig);
        this.recoStart = new Date();
        this.recognizer.recognizing = (s, e) => {
            var _a;
            (_a = this.onRecognizing) === null || _a === void 0 ? void 0 : _a.call(this, e.result.text);
        };
        this.recognizer.recognized = (s, e) => {
            var _a;
            let recoResult = this.convertResults(this.recoStart, e.result);
            (_a = this.onRecognized) === null || _a === void 0 ? void 0 : _a.call(this, recoResult);
        };
        this.recognizer.canceled = (s, e) => {
            var _a;
            let err = new Error(SpeechSDK.CancellationReason[e.reason]);
            if (this.onError) {
                this.onError.call(this, err);
            }
            else {
                (_a = this.onRecognized) === null || _a === void 0 ? void 0 : _a.call(this, null);
            }
        };
        this.recognizer.startContinuousRecognitionAsync();
    }
    stopRecognizing(wait) {
        if (this.recognizer) {
            setTimeout(() => {
                var _a;
                (_a = this.recognizer) === null || _a === void 0 ? void 0 : _a.close();
                this.recognizer = undefined;
            }, wait ? wait : 0);
        }
    }
    convertResults(recoStart, result) {
        if (result.reason === SpeechSDK.ResultReason.NoMatch) {
            return null;
        }
        let recoResult = new SpeechRecoResult();
        recoResult.startTime = this.addTicksToDate(recoStart, result.offset);
        recoResult.endTime = this.addTicksToDate(recoResult.startTime, result.duration);
        let jsonDetails = result.properties.getProperty(SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult);
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
            else if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z]+$/) >= 0) {
                let parts = item.text.match(/^(([a-zA-Z]\s)+)([a-zA-Z]+)$/);
                if (parts && parts.length == 4) {
                    const acronym = parts[1].replace(/\s/g, '');
                    const designator = parts[3];
                    const conf = item.confidence * 0.7;
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
        ;
        this.Duration = 0;
        this.DisplayText = '';
        this.NBest = [];
    }
}
class AzureSpeechNBestItem {
    constructor() {
        this.Confidence = 0;
        this.Lexical = '';
        this.ITN = '';
        this.MaskedITN = '';
        this.Display = '';
        this.Words = [];
    }
}
class AzureSpeechWordsItem {
    constructor() {
        this.Word = '';
        this.Confidence = 0;
    }
}
//# sourceMappingURL=stpazurespeech.js.map