import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { ISpeechRecognizer, ISpeechRecoResult } from '../../interfaces/ISpeechRecognizer';
export declare class AzureSpeechRecognizer implements ISpeechRecognizer {
    speechSubscriptionKey: string;
    serviceRegion: string;
    speechConfig: SpeechSDK.SpeechConfig;
    audioConfig: SpeechSDK.AudioConfig;
    recognizer: SpeechSDK.SpeechRecognizer | undefined;
    recoStart: Date;
    constructor(speechSubscriptionKey: string, serviceRegion: string, endPoint?: string, audioConfig?: SpeechSDK.AudioConfig);
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
