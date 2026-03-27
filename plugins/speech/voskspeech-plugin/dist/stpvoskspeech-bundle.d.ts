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

declare class VoskSpeechRecognizer implements ISpeechRecognizer {
    private _modelPath;
    private _sampleRate;
    private _workletPath;
    private _model;
    private _recognizer;
    private _modelReady;
    private _modelLoaded;
    private _modelError;
    private _audioContext;
    private _mediaStream;
    private _sourceNode;
    private _processorNode;
    private _workletRegistered;
    private _isListening;
    private _recoStart;
    private _pendingResults;
    private _graceTimer;
    private _gracePeriodMs;
    private _lastPartial;
    constructor(modelPath?: string, sampleRate?: number, workletPath?: string);
    private initializeModel;
    private ensureModelReady;
    onRecognized: ((result: ISpeechRecoResult | null) => void) | undefined;
    onRecognizing: ((snippet: string) => void) | undefined;
    onError: ((error: Error) => void) | undefined;
    recognizeOnce(maxRetries?: number): Promise<ISpeechRecoResult | null>;
    private tryRecoOnce;
    startRecognizing(): void;
    private startRecognizingAsync;
    stopRecognizing(wait?: number): void;
    private finalizeAndTeardown;
    private startAudioCapture;
    private cleanupResources;
    private handleResult;
    private handlePartialResult;
    private convertResult;
    private flushPendingResults;
    private spelledLettersToAcronym;
    private addSecondsToDate;
}

export { VoskSpeechRecognizer };
