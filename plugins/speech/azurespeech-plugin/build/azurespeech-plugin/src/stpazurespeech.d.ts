import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { ISpeechRecognizer, ISpeechRecoResult } from '../../interfaces/ISpeechRecognizer';
export declare class AzureSpeechRecognizer implements ISpeechRecognizer {
    speechSubscriptionKey: string;
    serviceRegion: string;
    audioConfig: SpeechSDK.AudioConfig;
    recognizer: SpeechSDK.SpeechRecognizer;
    constructor(speechSubscriptionKey: string, serviceRegion: string, endPoint?: string, audioConfig?: SpeechSDK.AudioConfig);
    recognize(maxRetries?: number): Promise<ISpeechRecoResult | null>;
    private recoOnce;
    private addTicksToDate;
}
