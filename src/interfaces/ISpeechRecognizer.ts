/**
 * Stp speech recognition results standard interface
 * @interface
 */

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
