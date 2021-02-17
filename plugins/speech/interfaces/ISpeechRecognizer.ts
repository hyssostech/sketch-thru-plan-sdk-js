/**
 * Stp interface to speech recognition engine
 * @interface
 */
export interface ISpeechRecognizer {
    /**
     * Activate the microphone and attempt to recognize speech in the next few seconds
     * Ideally, the recognition would include 2s of audio _before_ the call, drawing from some buffer
     * @param maxRetries - Number of time to retry before returning an error
     * @returns Recognized items/hypotheses, or null if nothing was recognized
     */
    recognizeOnce(maxRetries?: number): Promise<ISpeechRecoResult | null>;

    /**
     * Start the recognition process. Intermediate results are returned via the onRecognizing event;
     * final results (phrase) are returned via the onRecognized event
     * The expectation is that speech recognition is started at the beginning of a sketch, and stopped
     * sometime after the end of the sketch
     */
    startRecognizing(): void;

    /**
     * Stop the recognition process. Is normally called at the end of a sketch action
     * @param wait Time in seconds to wait before stopping recognition
     */
    stopRecognizing(wait?: number): void;

    /**
     * Event handler invoked whenever the recognizer has a complete phrase to return
     */
    onRecognized: ((result: ISpeechRecoResult | null) => void) | undefined;

    /**
     * Optional event handler invoked whenever the recognizer has a partial recognition available
     */
    onRecognizing: ((snippet: string) => void) | undefined;

    /**
     * Optional event handler invoked when there is a recognition error
     */
    onError: ((error: Error) => void) | undefined;
  }
  
  /**
   * Speech recognition results
   */
  export interface ISpeechRecoResult {
    /**
     * Speech recognition hypothesis
     */
    results: ISpeechRecoItem[];
    /**
     * Time speech started
     */
    startTime: Date;
    /**
     * Time speech ended
     */
    endTime: Date;
  }
  /**
   * Recognition hypotheses
   */
  export interface ISpeechRecoItem {
    /**
     * Transcribed speech text
     */
    text: string;
    /**
     * Likelihood/confidence of the interpretation
     */
    confidence: number;
  }
  