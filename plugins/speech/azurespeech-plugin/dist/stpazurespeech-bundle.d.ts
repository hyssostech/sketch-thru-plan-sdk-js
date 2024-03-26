import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

interface ISpeechRecognizer {
    recognizeOnce(maxRetries?: number): Promise<ISpeechRecoResult | null>;
    startRecognizing(): void;
    stopRecognizing(wait?: number): void;
    onRecognized: ((result: ISpeechRecoResult | null) => void) | undefined;
    onRecognizing: ((snippet: string) => void) | undefined;
    onError: ((error: Error) => void) | undefined;
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
    speechConfig: SpeechSDK.SpeechConfig;
    audioConfig: SpeechSDK.AudioConfig;
    phraseList: string[] | undefined;
    recognizer: SpeechSDK.SpeechRecognizer | undefined;
    recoStart: Date;
    isListening: boolean;
    constructor(speechSubscriptionKey: string, serviceRegion: string, endPoint?: string, audioConfig?: SpeechSDK.AudioConfig, recoLanguage?: string);
    setPhraseList(phrases: string[]): void;
    private initializeReco;
    onRecognized: ((result: ISpeechRecoResult | null) => void) | undefined;
    onRecognizing: ((snippet: string) => void) | undefined;
    onError: ((error: Error) => void) | undefined;
    recognizeOnce(maxRetries?: number): Promise<ISpeechRecoResult | null>;
    private tryReco;
    startRecognizing(): void;
    stopRecognizing(wait?: number): void;
    private convertResults;
    private addTicksToDate;
}

export { AzureSpeechRecognizer };
