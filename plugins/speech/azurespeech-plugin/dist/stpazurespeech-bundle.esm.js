import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

class AzureSpeechRecognizer {
    constructor(speechSubscriptionKey, serviceRegion, endPoint, audioConfig, recoLanguage) {
        this.speechSubscriptionKey = speechSubscriptionKey;
        this.serviceRegion = serviceRegion;
        this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(this.speechSubscriptionKey, this.serviceRegion);
        this.speechConfig.speechRecognitionLanguage = recoLanguage ? recoLanguage : 'en-US';
        this.speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
        if (endPoint) {
            this.speechConfig.endpointId = endPoint;
        }
        this.audioConfig = audioConfig
            ? audioConfig
            : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        this.isListening = false;
    }
    setPhraseList(phrases) {
        this.phraseList = phrases;
    }
    initializeReco() {
        this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig);
        if (this.phraseList) {
            const phraseList = SpeechSDK.PhraseListGrammar.fromRecognizer(this.recognizer);
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
                reject(new Error(SpeechSDK.CancellationReason[e.reason]));
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
            let err = new Error(SpeechSDK.CancellationReason[e.reason]);
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

export { AzureSpeechRecognizer };
