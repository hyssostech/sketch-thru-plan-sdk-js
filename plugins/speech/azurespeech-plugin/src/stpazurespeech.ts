  import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
  import {
    ISpeechRecognizer,
    ISpeechRecoResult,
    ISpeechRecoItem
  } from '../../interfaces/ISpeechRecognizer';
  
  /**
   * Implements speech recognition services using Azure Speech-to-text
   * @implements ISpeechRecognizer - {@link ISpeechRecognizer}
   */
  export class AzureSpeechRecognizer implements ISpeechRecognizer {
    speechSubscriptionKey: string;
    serviceRegion: string;
    audioConfig: SpeechSDK.AudioConfig;
    recognizer: SpeechSDK.SpeechRecognizer;
  
    /**
     * Constructs an Azure Speech recognizer object
     * @param speechSubscriptionKey - Azure speech subscription key
     * @param serviceRegion - Azure speech service region
     * @param endPoint - Custom model endpoint, if any
     * @param audioConfig - Optional audio config. Set to default mike input if not provided
     */
    constructor(
      speechSubscriptionKey: string,
      serviceRegion: string,
      endPoint?: string,
      audioConfig?: SpeechSDK.AudioConfig
    ) {
      this.speechSubscriptionKey = speechSubscriptionKey;
      this.serviceRegion = serviceRegion;
  
      // Create configuration requesting inclusion of n-best list in the results
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        this.speechSubscriptionKey,
        this.serviceRegion
      );
      //speechConfig.setServiceProperty("wordLevelConfidence","true", sdk.ServicePropertyChannel.UriQueryParameter);
      //speechConfig.setServiceProperty("format", "detailed", sdk.ServicePropertyChannel.UriQueryParameter);
      speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
  
      // Use a custom model endpoint if one was provided
      if (endPoint) {
        speechConfig.endpointId = endPoint;
      }
  
      // Initialize the recognizer - could do this only once, but this will re-establish a connection if lost
      this.audioConfig = audioConfig
        ? audioConfig
        : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      this.recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        this.audioConfig
      );
    }
  
    /**
     * Attempts to get a recognition, retrying if there are errors
     * @param maxRetries - Number of time to retry before returning an error
     * @returns - Recognition results, or null if nothing was recognized
     */
    recognize(maxRetries?: number): Promise<ISpeechRecoResult | null> {
      const delay: number = 250;
      // Default to retries that fit within 2s if not provided as a parameter
      if (!maxRetries) {
        maxRetries = 2000 / delay;
      }
      return new Promise<ISpeechRecoResult | null>(async (resolve, reject) => {
        for (let i: number = 0; i < maxRetries!; i++) {
          // Timing is provided in terms of deltas over the reco start, so capture the start here
          const recoStart: Date = new Date();
  
          // Perform a one-shot recognition attempt for a few seconds
          try {
            const recoResult: SpeechRecoResult | null = await this.recoOnce(recoStart);
            resolve(recoResult);
            return;
          } catch (e) {
            // TODO: log error, but otherwise ignore and try again
          }
          // Wait a bit before trying again if there ware more rounds to go
          if (i < maxRetries! - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        // Failed to recognized if dropped out of the retry loop
        reject(new Error('Failed to recognize speech'));
      });
    }
  
    /**
     * Performs a one-shot recognition
     * @returns - Recognition results, or null if nothing was recognized
     */
    private recoOnce(recoStart: Date): Promise<SpeechRecoResult | null> {
      return new Promise<SpeechRecoResult | null>((resolve, reject) => {
        this.recognizer.recognizeOnceAsync(
          (result) => {
            switch (result.reason) {
              case SpeechSDK.ResultReason.RecognizedSpeech:
                let recoResult = new SpeechRecoResult();
                recoResult.startTime = this.addTicksToDate(
                  recoStart,
                  result.offset
                );
                recoResult.endTime = this.addTicksToDate(
                  recoResult.startTime,
                  result.duration
                );
  
                // Get the n-best details from JSON - available because of the OutputFormat.Detailed config option
                let jsonDetails: string = result.properties.getProperty(
                  SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult
                );
                let detailedProperties: AzureSpeechDetailedResults = Object.assign(
                  new AzureSpeechDetailedResults(),
                  JSON.parse(jsonDetails)
                );
  
                // Extract the n-best results
                const basicConversion: SpeechRecoItem[] = detailedProperties.NBest.map(
                  (item) => new SpeechRecoItem(item.Lexical, item.Confidence)
                );
                recoResult.results = Array.from(basicConversion);
                // Add fresh hypotheses representing acronyms like "L D L C" => "LDLC"
                for (let i: number = 0; i < basicConversion.length; i++) {
                  const item = basicConversion[i];
                  // String of one or more letters followed by a space, ended with a letter
                  if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z]$/) >= 0) {
                    // Remove spaces and add hypothesis with a slightly lower confidence
                    const acronym: string = item.text.replace(/\s/g, '');
                    const conf: number = item.confidence * 0.9;
                    recoResult.results.push(new SpeechRecoItem(acronym, conf));
                  }
                }
                // All done - return results
                resolve(recoResult);
                // Stop listening so it does not pick additional speech after this first shot
                break;
              case SpeechSDK.ResultReason.NoMatch:
                // Silence or not processable
                resolve(null);
                break;
              case SpeechSDK.ResultReason.Canceled:
                var cancellation = SpeechSDK.CancellationDetails.fromResult(
                  result
                );
                reject(
                  new Error(SpeechSDK.CancellationReason[cancellation.reason])
                );
                break;
            }
          },
          (error) => {
            reject(new Error(error));
          }
        );
      });
    }
  
    /**
     * Calculates a date offset by a number of ticks (100 nano seconds)
     * @param date - Date ticks are to be added to
     * @param ticksToAdd - Ticks (100 nanoseconds increments) to add
     * @return Date bumped by the given ticks
     */
    private addTicksToDate(date: Date, ticksToAdd: number) {
      let dateTicks = date.getTime() * 10000 + 621355968000000000;
      let totalTicks = dateTicks + ticksToAdd;
      // Convert back to date
      let jsMilli = (totalTicks - 621355968000000000) / 10000;
      let res: Date = new Date(jsMilli);
      return res;
    }
  }
  
  /**
   * Recognition results - items recognized and time interval
   */
  class SpeechRecoResult implements ISpeechRecoResult {
    results: ISpeechRecoItem[];
    startTime: Date;
    endTime: Date;
    constructor() {
      this.results = [];
      this.startTime = new Date();
      this.endTime = new Date();
    }
  }
  
  /**
   * Recognition item, including recognized text and confidence
   */
  class SpeechRecoItem implements ISpeechRecoItem {
    text: string;
    confidence: number;
    constructor(text: string, confidence: number) {
      this.text = text;
      this.confidence = confidence;
    }
  }
  
  /**
   * Azure detailed recognition
   */
  class AzureSpeechDetailedResults {
    // JSON n-best details - see https://github.com/Azure-Samples/cognitive-services-speech-sdk/issues/12
    // {"Id":"12345767e9984244b4386631bd8a3b3d","RecognitionStatus":"Success","Offset":500000,"Duration":13200000,
    //  "DisplayText":"What's the weather like?",
    //  "NNBest":[
    //      {"Confidence":0.97701865,"Lexical":"what's the weather like","ITN":"what's the weather like",
    //          "MaskedITN":"what's the weather like","Display":"What's the weather like?",
    //          "Words":[{"Word":"what's","Confidence":0.9752328},
    //                  {"Word":"the","Confidence":0.9912971},
    //                  {"Word":"weather","Confidence":0.9947196},
    //                  {"Word":"like","Confidence":0.9936005}
    //          ]
    //      },
    //  ]}
    RecognitionStatus: string;
    Offset: number;
    Duration: number;
    DisplayText: string;
    NBest: AzureSpeechNBestItem[];
    constructor() {
      this.RecognitionStatus = '';
      this.Offset = 0;;
      this.Duration = 0;
      this.DisplayText = '';
      this.NBest = [];
    }
  }
  
  class AzureSpeechNBestItem {
    Confidence: number;
    Lexical: string;
    ITN: string;
    MaskedITN: string;
    Display: string;
    Words: AzureSpeechWordsItem[];
    constructor() {
      this.Confidence = 0;
      this.Lexical = '';
      this.ITN = '';
      this.MaskedITN = '';
      this.Display = '';
      this.Words = []
    }
  }
  
  class AzureSpeechWordsItem {
    Word: string;
    Confidence: number;
    constructor() {
      this.Word = '';
      this.Confidence = 0;
    }
  }
  