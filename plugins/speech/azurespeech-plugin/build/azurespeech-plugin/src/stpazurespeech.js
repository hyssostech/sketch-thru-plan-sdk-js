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
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
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
            reject(new Error('Failed to recognize speech'));
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