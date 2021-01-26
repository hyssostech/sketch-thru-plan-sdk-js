export interface ISpeechRecognizer {
    recognize(): Promise<ISpeechRecoResult | null>;
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
