  import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
  import {
    ISpeechRecognizer,
    ISpeechRecoResult,
    ISpeechRecoItem
  } from '../../interfaces/ISpeechRecognizer';
  
  /**
   * Implements speech recognition services using Azure Speech-to-text
    * @see {@link ISpeechRecognizer}
   */
  export class AzureSpeechRecognizer implements ISpeechRecognizer {
    speechSubscriptionKey: string;
    serviceRegion: string;
    speechConfig: SpeechSDK.SpeechConfig
    audioConfig: SpeechSDK.AudioConfig;
    phraseList: string[] | undefined;
    recognizer: SpeechSDK.SpeechRecognizer | undefined;
    recoStart: Date;
    isListening: boolean;
  
    //#region Construction / initialization
    /**
     * Constructs an Azure Speech recognizer object
     * @param speechSubscriptionKey - Azure speech subscription key
     * @param serviceRegion - Azure speech service region
     * @param endPoint - Custom model endpoint, if any
     * @param audioConfig - Optional audio config. Set to default mike input if not provided
     * @param recoLanguage - Optional language to be recognized. Default is 'en-US'
     */
    constructor(
      speechSubscriptionKey: string,
      serviceRegion: string,
      endPoint?: string,
      audioConfig?: SpeechSDK.AudioConfig,
      recoLanguage?: string
    ) {
      this.speechSubscriptionKey = speechSubscriptionKey;
      this.serviceRegion = serviceRegion;
  
      // Create configuration requesting inclusion of n-best list in the results
      this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        this.speechSubscriptionKey,
        this.serviceRegion
      );
      this.speechConfig.speechRecognitionLanguage = recoLanguage ? recoLanguage : 'en-US';

      //speechConfig.setServiceProperty("wordLevelConfidence","true", sdk.ServicePropertyChannel.UriQueryParameter);
      //speechConfig.setServiceProperty("format", "detailed", sdk.ServicePropertyChannel.UriQueryParameter);
      this.speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
  
      // Use a custom model endpoint if one was provided
      if (endPoint) {
        this.speechConfig.endpointId = endPoint;
      }
  
      // Initialize audio to the provided parameter, or to a microphone default
      this.audioConfig = audioConfig
        ? audioConfig
        : SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

        this.isListening = false;
    }

    /**
     * Set the list of phrases with enhanced importance for recognition
     * @param phrases 
     */
    setPhraseList(phrases: string[]){
      this.phraseList = phrases;
    }

    /**
     * Initialize the recognizer
     */
    private initializeReco() {
        this.recognizer = new SpeechSDK.SpeechRecognizer(
          this.speechConfig,
          this.audioConfig
        );
        // Set the phrase list, if provided
        if (this.phraseList) {
              const phraseList = SpeechSDK.PhraseListGrammar.fromRecognizer(this.recognizer);
              phraseList.addPhrases(this.phraseList);
        }
    }
    //#endregion Construction / initialization

    //#region Events
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
    //#endregion Events 

    //#region  Single-shot recognition
    /**
     * Activate the microphone and attempt to recognize speech in the next few seconds
     * Ideally, the recognition would include 2s of audio _before_ the call, drawing from some buffer
     * @param maxRetries - Number of time to retry before returning an error
     * @returns Recognized items/hypotheses, or null if nothing was recognized
     */
    recognizeOnce(maxRetries?: number): Promise<ISpeechRecoResult | null> {
      const delay: number = 250;
      // Default to retries that fit within 2s if not provided as a parameter
      if (!maxRetries) {
        maxRetries = 2000 / delay;
      }
      // Initialize the recognizer - could do this only once, but this will re-establish a connection if lost
      this.initializeReco();

      // Recognize
      return new Promise<ISpeechRecoResult | null>(async (resolve, reject) => {
        for (let i: number = 0; i < maxRetries!; i++) {
          // Timing is provided in terms of deltas over the reco start, so capture the start here
          this.recoStart = new Date();
  
          // Perform a one-shot recognition attempt for a few seconds
          try {
            const recoResult: SpeechRecoResult | null = await this.tryReco(this.recoStart);
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
        let err = new Error('Failed to recognize speech');
        this.onError?.call(this, err)
        reject(err);
      });
    }
  
    /**
     * Performs a one-shot recognition
     * @returns - Recognition results, or null if nothing was recognized
     */
    private tryReco(recoStart: Date): Promise<SpeechRecoResult | null> {
      return new Promise<SpeechRecoResult | null>((resolve, reject) => {
        // The event recognizing signals that an intermediate recognition result is received.
        // You will receive one or more recognizing events as a speech phrase is recognized, with each containing
        // more recognized speech. The event will contain the text for the recognition since the last phrase was recognized.
        this.recognizer!.recognizing = (s, e) => {
          // Add new bit of reco and invoke the user event, if any
          this.onRecognizing?.call(this, e.result.text);
        }

        // The event recognized signals that a final recognition result is received.
        // This is the final event that a phrase has been recognized.
        this.recognizer!.recognized = (s, e) => {
          // Pack into sdk-friendly result (can also be null if NoMatch)
          let recoResult = this.convertResults(recoStart, e.result);
          // Invoke user event, if one is set - normally it will not, as the results are already returned via a Promise
          this.onRecognized?.call(this, recoResult);
          // Resolve the Promise
          resolve(recoResult);
        }

        // The event signals that the service has stopped processing speech.
        // https://docs.microsoft.com/javascript/api/microsoft-cognitiveservices-speech-sdk/speechrecognitioncanceledeventargs?view=azure-node-latest
        // This can happen for two broad classes of reasons.
        // 1. An error is encountered.
        //    In this case the .errorDetails property will contain a textual representation of the error.
        // 2. No additional audio is available.
        //    Caused by the input stream being closed or reaching the end of an audio file.
        this.recognizer!.canceled = (s, e) => {
          this.isListening = false;
          reject(
            new Error(SpeechSDK.CancellationReason[e.reason])
          );
        }
        // Trigger one-time recognition if not listening already
        if (! this.isListening) {
          this.isListening = true;
          this.recognizer?.recognizeOnceAsync();
          this.isListening = false;
        }
      });
    }
    //#endregion Single-shot recognition

    //#region "Continuous" recognition
    /**
     * Start the recognition process. Intermediate results are returned via the onRecognizing event;
     * final results (phrase) are returned via the onRecognized event
     * The expectation is that speech recognition is started at the beginning of a sketch, and stopped
     * sometime after the end of the sketch
     */
    startRecognizing(): void {
      // Bail if already listening - don't want a second listening thread
      if (this.isListening) {
        return;
      }
      
      // Initialize the recognizer - could do this only once, but this will re-establish a connection if lost
      this.initializeReco();

      // Timing is provided in terms of deltas over the reco start, so capture the start here
      this.recoStart = new Date();

      // The event recognizing signals that an intermediate recognition result is received.
      // You will receive one or more recognizing events as a speech phrase is recognized, with each containing
      // more recognized speech. The event will contain the text for the recognition since the last phrase was recognized.
      this.recognizer!.recognizing = (s, e) => {
        // Add new bit of reco and invoke the user event, if any
        this.onRecognizing?.call(this, e.result.text);
      }

      // The event recognized signals that a final recognition result is received.
      // This is the final event that a phrase has been recognized.
      // For continuous recognition, you will get one recognized event for each phrase recognized.       
      this.recognizer!.recognized = (s, e) => {
          // Pack into sdk-friendly result (can also be null) and return
          let recoResult = this.convertResults(this.recoStart, e.result);
          this.onRecognized?.call(this, recoResult);
      }

      // The event signals that the service has stopped processing speech.
      // https://docs.microsoft.com/javascript/api/microsoft-cognitiveservices-speech-sdk/speechrecognitioncanceledeventargs?view=azure-node-latest
      // This can happen for two broad classes of reasons.
      // 1. An error is encountered.
      //    In this case the .errorDetails property will contain a textual representation of the error.
      // 2. No additional audio is available.
      //    Caused by the input stream being closed or reaching the end of an audio file.
      this.recognizer!.canceled = (s, e) => {
        this.isListening = false;
        let err = new Error(SpeechSDK.CancellationReason[e.reason]);
        if (this.onError) {
          this.onError.call(this, err);
        }
        else {
          // Since client is not listening to errors, signal an empty recognition notify the client the process has been completed, albeit with no results
          this.onRecognized?.call(this, null);
        }
      }

      // Get the recognition started
      this.isListening = true;
      this.recognizer!.startContinuousRecognitionAsync();
    }

    /**
     * Stop the recognition process. Is normally called at the end of a sketch action
     * @param wait Time in milliseconds to wait before stopping recognition
     */
    stopRecognizing(wait?: number): void {
      // If the recognizer is still active, set it to be wrapped in the many 'wait' seconds
      if (this.recognizer) {
        setTimeout(() => {
            this.recognizer?.close();
            this.recognizer = undefined;
          },
          wait ? wait : 0
        );
      }
      this.isListening = false;
    }
    //#endregion "Continuous" recognition

    //#region Utility
    private convertResults(recoStart: Date, result: SpeechSDK.SpeechRecognitionResult): SpeechRecoResult | null {
      // NoMatch indicates that recognizable speech was not detected, and that recognition is done.
      if (result.reason === SpeechSDK.ResultReason.NoMatch) {
        //var noMatchDetail = SpeechSDK.NoMatchDetails.fromResult(e.result);
        return null;
      }

      // Successful recognition - pack into sdk-friendly result
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
      // Clone the results so as to keep the basic list used in the iteration unchanged as new items are added
      let resultsArray: SpeechRecoItem[]  = Array.from(basicConversion);
      // Add fresh hypotheses representing acronyms like "L D L C" => "LDLC"
      for (let i: number = 0; i < basicConversion.length; i++) {
        const item = basicConversion[i];
        // String of one or more occurrences of a letter followed by a space, ended with a letter
        // Or these space-separated letters followed by a designator
        if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z]$/) >= 0) {
          // Remove spaces and add hypothesis with a slightly lower confidence
          const acronym: string = item.text.replace(/\s/g, '');
          const conf: number = item.confidence * 0.9;
          resultsArray.push(new SpeechRecoItem(acronym, conf));
        }
        else if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z][a-zA-Z]+$/) >= 0) {
          // Break space-separated letters from designator
          let parts: RegExpMatchArray | null = item.text.match(/^(([a-zA-Z]\s)+)([a-zA-Z][a-zA-Z]+)$/);
          if (parts && parts.length == 4) {
            // Remove spaces and add hypothesis with even lower confidence
            const acronym: string = parts[1].replace(/\s/g, '');
            const designator: string= parts[3];
            const conf: number = item.confidence * 0.85;
            resultsArray.push(new SpeechRecoItem(acronym + ' ' + designator, conf));
          }
        }
      }
      // Add results sorted descending by confidence, to the result record
      recoResult.results = resultsArray.sort((a, b) => b.confidence - a.confidence);
      // All done - return results
      return recoResult;
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
    //#endregion Utility
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
  