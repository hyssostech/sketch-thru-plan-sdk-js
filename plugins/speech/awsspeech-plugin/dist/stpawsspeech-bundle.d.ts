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

declare class AwsSpeechRecognizer implements ISpeechRecognizer {
    private accessKeyId;
    private secretAccessKey;
    private sessionToken;
    private region;
    private languageCode;
    private client;
    private recoStart;
    private isListening;
    private mediaStream;
    private audioContext;
    private processorNode;
    private sourceNode;
    private audioQueue;
    private audioQueueResolve;
    private audioStreamDone;
    private abortController;
    constructor(accessKeyId: string, secretAccessKey: string, region: string, sessionToken?: string, recoLanguage?: string);
    onRecognized: ((result: ISpeechRecoResult | null) => void) | undefined;
    onRecognizing: ((snippet: string) => void) | undefined;
    onError: ((error: Error) => void) | undefined;
    recognizeOnce(maxRetries?: number): Promise<ISpeechRecoResult | null>;
    private trySingleReco;
    startRecognizing(): void;
    private runContinuousRecognition;
    stopRecognizing(wait?: number): void;
    private doStop;
    private startMicrophone;
    private stopMicrophone;
    private cleanup;
    private pcmEncode;
    private createAudioStream;
    private convertResult;
}

export { AwsSpeechRecognizer };
