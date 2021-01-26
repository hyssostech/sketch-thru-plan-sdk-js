/**
 * Stp interface to speech recognition engine
 * @interface
 */
export interface ISpeechRecognizer {
    /**
     * Start recognizing speech
     * At a minimum the speech in the next few seconds should be interpreted. Ideally, the recognition
     * would include 2s of audio _before_ the call, drawing from some buffer
     * @returns Recognized items/hypotheses
     */
    recognize(): Promise<ISpeechRecoResult | null>;
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
  