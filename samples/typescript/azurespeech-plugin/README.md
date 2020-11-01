# STP Plugin: Microsoft Cognitive Services Speech

## Speech recognition strategies

STP operates by combining multiple types of user input (or *modalities*) such as sketches and speech, and producing interpretations that represent the combination of these modalities. Users naturally produce the sketches and the speech that it relates to in close temporal proximity: a sketch and the speech it relates to are produced in general within a few seconds of each other.

Taking advantage of this natural style, STP uses sketch start events as anchors points around which speech produced within a window of a few seconds is considered for combined interpretation. A few strategies for handling speech interpretation are therefore possible:

* Activate recognition at the start of each stroke - this is a simple, but effective strategy. Users need to be mindful in this case that whatever they speak before the stroke is started will not be captured by the system. This is the strategy used in the [quickstart](../../quickstart/js)

* Capture 2 seconds of audio before the start of each stroke - ideally, audio buffers would be accessed to extract a limited amount of audio just before the start of a stroke, so that no part of the speech is lost, even if users start to talk a bit before sketching. This depends on specific audio techniques that are out of scope of the present discussion

* Continuous recognition - speech can also be transcribed/recognized continuously, and sent over to STP for consideration. STP has mechanisms to just consider speech that might be relevant. This is approach maximizes the capture of users' speech, but comes at additional computational costs because of the constant transcription of an open microphone

## Speech recognizer configuration in STP

Any capable speech recognition engine can be used with STP. It is recommended that their services be exposed to STP apps using a standard interface so that engines can be swapped without impacting the rest of the application. 

The SDK provides one such interface - [`IStpSpeechRecognizer`](interfaces/IStpSpeechRecognizer):

```javascript
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
    recognize(): Promise<ISpeechRecoResult>;
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
```

## The Microsoft Cognitive Services Speech plugin

The SDK bundles an implementation of the Microsoft Cognitive Services Speech to Text. It implements the simpler strategy of performing recognition once at a time. The expectation is that the `recognize` method is invoked by the client app whenever a pen down is detected (see [quicktstart](../../quickstart/js) for an example)

The typescript implementation is available in  [`stpazurespeech.ts`](stpazurespeech.ts)
