import { AudioConfig, SpeechRecognizer } from 'microsoft-cognitiveservices-speech-sdk';

interface ISpeechRecognizer {
    recognize(): Promise<ISpeechRecoResult | null>;
}
interface ISpeechRecoResult {
    results: ISpeechRecoItem[];
    startTime: Date;
    endTime: Date;
}
interface ISpeechRecoItem {
    text: string;
    confidence: number;
}

declare class AzureSpeechRecognizer implements ISpeechRecognizer {
    speechSubscriptionKey: string;
    serviceRegion: string;
    audioConfig: AudioConfig;
    recognizer: SpeechRecognizer;
    constructor(speechSubscriptionKey: string, serviceRegion: string, endPoint?: string, audioConfig?: AudioConfig);
    recognize(maxRetries?: number): Promise<ISpeechRecoResult | null>;
    private recoOnce;
    private addTicksToDate;
}

export { AzureSpeechRecognizer };
