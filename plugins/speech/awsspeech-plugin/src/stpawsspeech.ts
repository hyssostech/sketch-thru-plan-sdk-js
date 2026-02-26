import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  LanguageCode,
} from '@aws-sdk/client-transcribe-streaming';
import {
  ISpeechRecognizer,
  ISpeechRecoResult,
  ISpeechRecoItem,
} from '../../interfaces/ISpeechRecognizer';

/**
 * Target audio sample rate used for PCM encoding.
 * AWS Transcribe Streaming supports 8000-48000 Hz; 16000 is optimal for speech.
 */
const TARGET_SAMPLE_RATE = 16000;

/**
 * Implements speech recognition services using Amazon Transcribe Streaming
 * @see {@link ISpeechRecognizer}
 */
export class AwsSpeechRecognizer implements ISpeechRecognizer {
  private accessKeyId: string;
  private secretAccessKey: string;
  private sessionToken: string | undefined;
  private region: string;
  private languageCode: LanguageCode;
  private client: TranscribeStreamingClient;
  private recoStart: Date;
  private isListening: boolean;

  /** Active microphone MediaStream (released on stop) */
  private mediaStream: MediaStream | null;
  /** Web Audio context used for PCM capture */
  private audioContext: AudioContext | null;
  /** Audio worklet / script-processor node used to grab raw samples */
  private processorNode: ScriptProcessorNode | null;
  /** Source node wired from the microphone MediaStream */
  private sourceNode: MediaStreamAudioSourceNode | null;

  /** Queue of PCM-encoded chunks waiting to be consumed by the async audio generator */
  private audioQueue: ArrayBuffer[];
  /** Resolves the next pending dequeue when a chunk arrives */
  private audioQueueResolve: (() => void) | null;
  /** When true the generator should stop yielding */
  private audioStreamDone: boolean;

  /** The AbortController used to cancel a running transcription session */
  private abortController: AbortController | null;

  //#region Construction / initialization
  /**
   * Constructs an AWS Transcribe Streaming speech recognizer
   * @param accessKeyId - AWS IAM access key ID (or Cognito-derived key)
   * @param secretAccessKey - AWS IAM secret access key
   * @param region - AWS region for the Transcribe service (e.g. 'us-east-1')
   * @param sessionToken - Optional session token (when using temporary credentials / Cognito)
   * @param recoLanguage - Optional language code. Default is 'en-US'
   */
  constructor(
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
    sessionToken?: string,
    recoLanguage?: string
  ) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.region = region;
    this.languageCode = (recoLanguage ?? 'en-US') as LanguageCode;

    this.client = new TranscribeStreamingClient({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        sessionToken: this.sessionToken,
      },
    });

    this.isListening = false;
    this.recoStart = new Date();

    this.mediaStream = null;
    this.audioContext = null;
    this.processorNode = null;
    this.sourceNode = null;

    this.audioQueue = [];
    this.audioQueueResolve = null;
    this.audioStreamDone = false;
    this.abortController = null;
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

  //#region Single-shot recognition
  /**
   * Activate the microphone and attempt to recognize speech in the next few seconds.
   * Returns the first final transcription result.
   * @param maxRetries - Number of times to retry before returning an error
   * @returns Recognized items/hypotheses, or null if nothing was recognized
   */
  async recognizeOnce(maxRetries?: number): Promise<ISpeechRecoResult | null> {
    const delay = 250;
    if (!maxRetries) {
      maxRetries = 2000 / delay;
    }

    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.trySingleReco();
        return result;
      } catch (_e) {
        // Ignore and retry
      }
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    const err = new Error('Failed to recognize speech');
    this.onError?.call(this, err);
    throw err;
  }

  /**
   * Performs a single recognition attempt: starts transcription, waits for the
   * first final result, then tears down the stream.
   */
  private async trySingleReco(): Promise<ISpeechRecoResult | null> {
    this.recoStart = new Date();
    await this.startMicrophone();

    const audioStream = this.createAudioStream();
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: this.languageCode,
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: TARGET_SAMPLE_RATE,
      AudioStream: audioStream,
    });

    try {
      this.abortController = new AbortController();
      const response = await this.client.send(command, {
        abortSignal: this.abortController.signal,
      });

      if (!response.TranscriptResultStream) {
        this.cleanup();
        return null;
      }

      // Iterate over transcript events; return on the first final result
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript?.Results ?? [];
          for (const result of results) {
            if (result.IsPartial) {
              // Emit partial / intermediate
              const snippet = (result.Alternatives ?? [])
                .map((alt) =>
                  (alt.Items ?? []).map((it) => it.Content).join(' ')
                )
                .join(' ');
              this.onRecognizing?.call(this, snippet);
            } else {
              // Final result
              const recoResult = this.convertResult(result);
              this.onRecognized?.call(this, recoResult);
              this.cleanup();
              return recoResult;
            }
          }
        }
      }
      // Stream ended with no final result
      this.cleanup();
      return null;
    } catch (e: any) {
      this.cleanup();
      throw e;
    }
  }
  //#endregion Single-shot recognition

  //#region "Continuous" recognition
  /**
   * Start the recognition process. Intermediate results are returned via the onRecognizing event;
   * final results (phrase) are returned via the onRecognized event.
   * The expectation is that speech recognition is started at the beginning of a sketch, and stopped
   * sometime after the end of the sketch.
   */
  startRecognizing(): void {
    if (this.isListening) {
      return;
    }
    this.isListening = true;
    this.recoStart = new Date();

    // Fire-and-forget the async streaming loop
    this.runContinuousRecognition().catch((e) => {
      this.isListening = false;
      if (this.onError) {
        this.onError.call(this, e instanceof Error ? e : new Error(String(e)));
      } else {
        this.onRecognized?.call(this, null);
      }
    });
  }

  /**
   * Internal async loop that drives continuous recognition.
   */
  private async runContinuousRecognition(): Promise<void> {
    await this.startMicrophone();

    const audioStream = this.createAudioStream();
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: this.languageCode,
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: TARGET_SAMPLE_RATE,
      AudioStream: audioStream,
    });

    this.abortController = new AbortController();
    const response = await this.client.send(command, {
      abortSignal: this.abortController.signal,
    });

    if (!response.TranscriptResultStream) {
      this.cleanup();
      return;
    }

    try {
      for await (const event of response.TranscriptResultStream) {
        if (!this.isListening) break;

        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript?.Results ?? [];
          for (const result of results) {
            if (result.IsPartial) {
              const snippet = (result.Alternatives ?? [])
                .map((alt) =>
                  (alt.Items ?? []).map((it) => it.Content).join(' ')
                )
                .join(' ');
              this.onRecognizing?.call(this, snippet);
            } else {
              const recoResult = this.convertResult(result);
              this.onRecognized?.call(this, recoResult);
            }
          }
        }
      }
    } catch (e: any) {
      // AbortError is expected when we call stopRecognizing
      if (e.name !== 'AbortError') {
        throw e;
      }
    } finally {
      this.cleanup();
    }
  }

  /**
   * Stop the recognition process. Is normally called at the end of a sketch action.
   * @param wait Time in milliseconds to wait before stopping recognition
   */
  stopRecognizing(wait?: number): void {
    if (wait && wait > 0) {
      setTimeout(() => this.doStop(), wait);
    } else {
      this.doStop();
    }
  }

  private doStop(): void {
    this.isListening = false;
    // Signal the audio generator to stop
    this.audioStreamDone = true;
    if (this.audioQueueResolve) {
      this.audioQueueResolve();
      this.audioQueueResolve = null;
    }
    // Abort the running transcription request
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.stopMicrophone();
  }
  //#endregion "Continuous" recognition

  //#region Microphone capture and PCM encoding
  /**
   * Starts capturing audio from the default microphone and feeds PCM-encoded
   * chunks into {@link audioQueue}.
   */
  private async startMicrophone(): Promise<void> {
    this.audioQueue = [];
    this.audioQueueResolve = null;
    this.audioStreamDone = false;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // Use a standard AudioContext; fall back to webkitAudioContext on Safari
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE }) as AudioContext;

    this.sourceNode = this.audioContext.createMediaStreamSource(
      this.mediaStream
    );

    // Use ScriptProcessorNode (widely supported). Buffer 4096 frames, mono.
    const bufferSize = 4096;
    this.processorNode = this.audioContext.createScriptProcessor(
      bufferSize,
      1,
      1
    );

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (this.audioStreamDone) return;
      const inputData = event.inputBuffer.getChannelData(0);
      const pcm = this.pcmEncode(inputData);
      this.audioQueue.push(pcm);
      // Wake up the async generator if it is waiting
      if (this.audioQueueResolve) {
        this.audioQueueResolve();
        this.audioQueueResolve = null;
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
  }

  /**
   * Releases the microphone and tears down the audio graph.
   */
  private stopMicrophone(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Common cleanup called after a transcription session ends.
   */
  private cleanup(): void {
    this.isListening = false;
    this.audioStreamDone = true;
    this.stopMicrophone();
  }

  /**
   * Encodes a Float32Array of audio samples into 16-bit signed PCM (little-endian).
   * @param float32 - Raw audio samples, range [-1, 1]
   * @returns ArrayBuffer containing the PCM data
   */
  private pcmEncode(float32: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  /**
   * Creates an async generator that yields audio chunks in the shape expected
   * by StartStreamTranscriptionCommand.
   */
  private createAudioStream(): AsyncGenerator<
    { AudioEvent: { AudioChunk: Uint8Array } },
    void,
    unknown
  > {
    const self = this;
    return (async function* () {
      while (!self.audioStreamDone) {
        // Wait for data if the queue is empty
        if (self.audioQueue.length === 0) {
          await new Promise<void>((resolve) => {
            self.audioQueueResolve = resolve;
          });
        }
        // Drain all available chunks
        while (self.audioQueue.length > 0) {
          const chunk = self.audioQueue.shift()!;
          yield {
            AudioEvent: {
              AudioChunk: new Uint8Array(chunk),
            },
          };
        }
      }
    })();
  }
  //#endregion Microphone capture and PCM encoding

  //#region Result conversion
  /**
   * Converts an AWS Transcribe result into the plugin-standard ISpeechRecoResult.
   * AWS Transcribe does not provide timing offsets that map neatly to the Azure
   * model, so we approximate start/end times relative to the session start.
   */
  private convertResult(
    result: any
  ): ISpeechRecoResult | null {
    const alternatives = result.Alternatives ?? [];
    if (alternatives.length === 0) return null;

    // Build the items array from each alternative
    const items: ISpeechRecoItem[] = [];
    for (const alt of alternatives) {
      const text = (alt.Items ?? []).map((it: any) => it.Content).join(' ');
      // AWS provides a per-item confidence; average them for the phrase
      const confidences = (alt.Items ?? [])
        .map((it: any) => it.Confidence)
        .filter((c: any) => c != null);
      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a: number, b: number) => a + b, 0) /
            confidences.length
          : 1.0;
      items.push(new SpeechRecoItem(text, avgConfidence));
    }

    // Determine timing from the first alternative's items
    const firstAlt = alternatives[0];
    const firstItems = firstAlt.Items ?? [];
    const startSec =
      firstItems.length > 0 && firstItems[0].StartTime != null
        ? firstItems[0].StartTime
        : 0;
    const endSec =
      firstItems.length > 0 &&
      firstItems[firstItems.length - 1].EndTime != null
        ? firstItems[firstItems.length - 1].EndTime
        : 0;

    const recoResult = new SpeechRecoResult();
    recoResult.startTime = new Date(this.recoStart.getTime() + startSec * 1000);
    recoResult.endTime = new Date(this.recoStart.getTime() + endSec * 1000);
    recoResult.results = items.sort((a, b) => b.confidence - a.confidence);

    // Add acronym hypotheses (matching Azure plugin behavior)
    const basicConversion = Array.from(items);
    for (const item of basicConversion) {
      // String of one or more occurrences of a letter followed by a space, ended with a letter
      if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z]$/) >= 0) {
        const acronym = item.text.replace(/\s/g, '');
        const conf = item.confidence * 0.9;
        recoResult.results.push(new SpeechRecoItem(acronym, conf));
      } else if (item.text.search(/^([a-zA-Z]\s)+[a-zA-Z][a-zA-Z]+$/) >= 0) {
        const parts = item.text.match(
          /^(([a-zA-Z]\s)+)([a-zA-Z][a-zA-Z]+)$/
        );
        if (parts && parts.length === 4) {
          const acronym = parts[1].replace(/\s/g, '');
          const designator = parts[3];
          const conf = item.confidence * 0.85;
          recoResult.results.push(
            new SpeechRecoItem(acronym + ' ' + designator, conf)
          );
        }
      }
    }
    // Re-sort after adding acronyms
    recoResult.results.sort((a, b) => b.confidence - a.confidence);

    return recoResult;
  }
  //#endregion Result conversion
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
