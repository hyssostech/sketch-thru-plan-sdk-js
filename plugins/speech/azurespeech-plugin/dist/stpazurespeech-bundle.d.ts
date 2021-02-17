import { SpeechConfig, AudioConfig, SpeechRecognizer } from 'microsoft-cognitiveservices-speech-sdk';

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
    speechConfig: SpeechConfig;
    audioConfig: AudioConfig;
    recognizer: SpeechRecognizer | undefined;
    recoStart: Date;
    constructor(speechSubscriptionKey: string, serviceRegion: string, endPoint?: string, audioConfig?: AudioConfig);
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
