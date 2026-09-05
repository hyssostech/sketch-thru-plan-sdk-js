import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { ISpeechRecognizer, ISpeechRecoResult } from '../../interfaces/ISpeechRecognizer';
export declare class AzureSpeechRecognizer implements ISpeechRecognizer {
    speechSubscriptionKey: string;
    serviceRegion: string;
    speechConfig: SpeechSDK.SpeechConfig;
    audioConfig: SpeechSDK.AudioConfig;
    phraseList: string[] | undefined;
    recognizer: SpeechSDK.SpeechRecognizer | undefined;
    recoStart: Date;
    isListening: boolean;
    private _pendingResults;
    private _graceTimer;
    private _gracePeriodMs;
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
    setGracePeriod(ms: number): void;
    private _flushPendingResults;
    private convertResults;
    private addTicksToDate;
}
