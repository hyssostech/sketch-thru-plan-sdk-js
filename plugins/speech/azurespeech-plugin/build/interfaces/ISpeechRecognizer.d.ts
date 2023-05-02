export interface ISpeechRecognizer {
    recognizeOnce(maxRetries?: number): Promise<ISpeechRecoResult | null>;
    startRecognizing(): void;
    stopRecognizing(wait?: number): void;
    onRecognized: ((result: ISpeechRecoResult | null) => void) | undefined;
    onRecognizing: ((snippet: string) => void) | undefined;
    onError: ((error: Error) => void) | undefined;
}
export interface ISpeechRecoResult {
    results: ISpeechRecoItem[];
    startTime: Date;
    endTime: Date;
}
export interface ISpeechRecoItem {
    text: string;
    confidence: number;
}
