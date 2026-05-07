import { createModel, Model, KaldiRecognizer } from 'vosk-browser';
import {
  ISpeechRecognizer,
  ISpeechRecoResult,
  ISpeechRecoItem,
} from '../../interfaces/ISpeechRecognizer';
import type {
  ServerMessageResult,
  ServerMessagePartialResult,
} from 'vosk-browser/dist/interfaces';

/**
 * Implements offline speech recognition in the browser using Vosk WebAssembly.
 *
 * Uses a domain-adapted Kaldi model co-deployed with the application as static files.
 * The model is loaded eagerly in the constructor so that recognition is ready by the
 * time the user starts sketching.
 *
 * **Setup**: The Vosk model directory must be served as static files alongside the
 * application. See the plugin README for details on the required model archive.
 *
 * @see {@link ISpeechRecognizer}
 */
export class VoskSpeechRecognizer implements ISpeechRecognizer {
  private _modelPath: string;
  private _sampleRate: number;
  private _workletPath: string;
  private _model: Model | null = null;
  private _recognizer: KaldiRecognizer | null = null;
  private _modelReady: Promise<void>;
  private _modelLoaded: boolean = false;
  private _modelError: Error | null = null;

  private _audioContext: AudioContext | null = null;
  private _mediaStream: MediaStream | null = null;
  private _sourceNode: MediaStreamAudioSourceNode | null = null;
  private _processorNode: AudioWorkletNode | null = null;
  private _workletRegistered: boolean = false;

  private _isListening: boolean = false;
  private _recoStart: Date = new Date();

  onModelReady: (() => void) | null = null;

  // vosk-browser results include a single "text" field per result event.
  // We accumulate partial and final results similarly to the Azure plugin.
  private _pendingResults: SpeechRecoResult[] = [];
  private _graceTimer: ReturnType<typeof setTimeout> | null = null;
  private _gracePeriodMs: number = 1500;
  private _lastPartial: string = '';

  //#region Construction / initialization
  /**
   * Constructs a Vosk browser speech recognizer.
   * Model loading begins immediately in the background.
   *
   * @param modelPath - Relative or absolute URL to the directory containing the unpacked
   *                    Vosk model files (am/, conf/, graph/, ivector/ and manifest.json).
   *                    Defaults to `'./model'`. The directory must be served as static files.
   * @param sampleRate - Sample rate for recognition. Defaults to 16000.
   * @param workletPath - URL to the vosk-processor.js AudioWorklet file.
   *                      Defaults to `'vosk-processor.js'` (relative to the page).
   */
  constructor(modelPath?: string, sampleRate?: number, workletPath?: string) {
    this._modelPath = modelPath ?? './model';
    this._sampleRate = sampleRate ?? 16000;
    this._workletPath = workletPath ?? 'vosk-processor.js';

    // Start loading immediately — ready by the time user starts interacting
    this._modelReady = this.initializeModel();
  }

  /**
   * Load the Vosk WASM model from the co-deployed model directory.
   */
  private async initializeModel(): Promise<void> {
    try {
      // Resolve relative model path to an absolute URL.
      // vosk-browser loads the model inside a Web Worker (blob: origin),
      // so relative URLs would resolve against the blob, not the page.
      const absoluteModelUrl = new URL(this._modelPath, window.location.href).href;

      // Quick check: probe manifest.json to give a clear error before
      // vosk-browser produces a cryptic WASM/fetch failure
      const manifestUrl = absoluteModelUrl.replace(/\/$/, '') + '/manifest.json';
      const probe = await fetch(manifestUrl, { method: 'HEAD' });
      if (!probe.ok) {
        throw new Error(
          `Model not found at '${this._modelPath}'. ` +
          `Extract vosk-model-la-domain.zip into that directory — see the plugin README for instructions.`
        );
      }

      this._model = await createModel(absoluteModelUrl, -1);
      this._model.setLogLevel(-1);
      this._modelLoaded = true;
      this.onModelReady?.call(this);
    } catch (e: any) {
      this._modelError = new Error(`Failed to load Vosk model from '${this._modelPath}': ${e.message || e}`);
      this.onError?.call(this, this._modelError);
    }
  }

  /**
   * Wait until the model is loaded. Throws if model loading failed.
   */
  private async ensureModelReady(): Promise<void> {
    await this._modelReady;
    if (this._modelError) {
      throw this._modelError;
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

  //#region Single-shot recognition
  /**
   * Activate the microphone and attempt to recognize speech.
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
        const result = await this.tryRecoOnce();
        return result;
      } catch (e) {
        // Retry
      }
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const err = new Error('Failed to recognize speech');
    this.onError?.call(this, err);
    throw err;
  }

  /**
   * Perform a single recognition attempt: start mic, wait for a result,
   * then stop.
   */
  private async tryRecoOnce(): Promise<ISpeechRecoResult | null> {
    return new Promise<ISpeechRecoResult | null>(async (resolve, reject) => {
      // Temporarily override onRecognized to capture the result
      const originalOnRecognized = this.onRecognized;
      this.onRecognized = (result) => {
        this.onRecognized = originalOnRecognized;
        this.stopRecognizing();
        resolve(result);
      };

      try {
        this.startRecognizing();

        // Timeout after 10 seconds if no result
        setTimeout(() => {
          this.onRecognized = originalOnRecognized;
          this.stopRecognizing();
          resolve(null);
        }, 10000);
      } catch (e) {
        this.onRecognized = originalOnRecognized;
        reject(e);
      }
    });
  }
  //#endregion Single-shot recognition

  //#region Continuous recognition
  /**
   * Start the recognition process. Intermediate results are returned via onRecognizing;
   * final results are returned via onRecognized.
   */
  startRecognizing(): void {
    if (this._isListening) {
      return;
    }
    this._isListening = true;
    this._recoStart = new Date();
    this._pendingResults = [];

    // Launch async mic + recognizer setup
    this.startRecognizingAsync().catch((e: any) => {
      this._isListening = false;
      this.onError?.call(this, e instanceof Error ? e : new Error(String(e)));
    });
  }

  /**
   * Internal async startup: wait for model, open mic, wire recognizer.
   */
  private async startRecognizingAsync(): Promise<void> {
    await this.ensureModelReady();
    // Create a new KaldiRecognizer for this session
    const RecognizerClass = this._model!.KaldiRecognizer;
    this._recognizer = new RecognizerClass(this._sampleRate);
    this._recognizer.setWords(true);

    // Subscribe to recognizer events
    this._recognizer.on('result', (message: any) => {
      this.handleResult(message as ServerMessageResult);
    });

    this._recognizer.on('partialresult', (message: any) => {
      this.handlePartialResult(message as ServerMessagePartialResult);
    });

    this._recognizer.on('error', (message: any) => {
      this.onError?.call(this, new Error(`Vosk recognition error: ${(message as any).error || message}`));
    });

    // Open microphone and connect audio pipeline
    await this.startAudioCapture();
  }

  /**
   * Stop the recognition process.
   * @param wait - Time in milliseconds to wait before stopping recognition
   */
  stopRecognizing(wait?: number): void {
    if (wait && wait > 0) {
      // Keep listening for `wait` ms more, then finalize
      setTimeout(() => this.finalizeAndTeardown(), wait);
    } else {
      this.finalizeAndTeardown();
    }
  }

  /**
   * Stop audio capture, retrieve the final recognition result, then clean up.
   * retrieveFinalResult() is async (sends a message to the WASM worker),
   * so we must wait for the 'result' event before destroying the recognizer.
   */
  private finalizeAndTeardown(): void {
    this._isListening = false;

    if (this._recognizer) {
      // Timeout fallback: if retrieveFinalResult never fires, flush and clean up anyway
      const timeoutId = setTimeout(() => {
        this.flushPendingResults();
        this.cleanupResources();
      }, 1000);

      // One-shot listener for the final result that retrieveFinalResult() will produce.
      // The original handler from startRecognizingAsync fires first (adds to _pendingResults),
      // then this fires to flush and clean up.
      const onFinal = (_message: any) => {
        clearTimeout(timeoutId);
        // Give the original handler a tick to add to _pendingResults
        setTimeout(() => {
          this.flushPendingResults();
          this.cleanupResources();
        }, 0);
      };
      this._recognizer.on('result', onFinal);

      // Ask the recognizer to finalize whatever it has
      this._recognizer.retrieveFinalResult();
    } else {
      this.flushPendingResults();
      this.cleanupResources();
    }
  }
  //#endregion Continuous recognition

  //#region Audio capture
  /**
   * Set up the microphone audio pipeline using AudioWorklet.
   */
  private async startAudioCapture(): Promise<void> {
    // Request microphone access
    this._mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: this._sampleRate,
      },
    });

    // Create audio context
    this._audioContext = new AudioContext({ sampleRate: this._sampleRate });

    // Register the AudioWorklet processor if not already done
    if (!this._workletRegistered) {
      // vosk-processor.js must be served alongside the plugin bundle
      await this._audioContext.audioWorklet.addModule(this._workletPath);
      this._workletRegistered = true;
    }

    // Create source → worklet pipeline
    this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream);
    this._processorNode = new AudioWorkletNode(this._audioContext, 'vosk-processor');

    // Feed audio chunks to the Vosk recognizer
    this._processorNode.port.onmessage = (event: MessageEvent) => {
      if (this._recognizer && this._isListening) {
        const audioData = event.data as Float32Array;
        this._recognizer.acceptWaveformFloat(audioData, this._audioContext!.sampleRate);
      }
    };

    // Connect: mic → worklet (worklet posts data via port, no output needed)
    this._sourceNode.connect(this._processorNode);
    this._processorNode.connect(this._audioContext.destination);
  }

  /**
   * Release audio and recognizer resources.
   * Called only after the final result has been captured.
   */
  private cleanupResources(): void {
    // Disconnect audio nodes
    if (this._processorNode) {
      this._processorNode.disconnect();
      this._processorNode = null;
    }
    if (this._sourceNode) {
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }

    // Stop all media tracks (releases microphone)
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach((t) => t.stop());
      this._mediaStream = null;
    }

    // Close audio context
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
      this._workletRegistered = false;
    }

    // Remove the recognizer instance (model stays loaded for reuse)
    if (this._recognizer) {
      this._recognizer.remove();
      this._recognizer = null;
    }

    this._lastPartial = '';
  }
  //#endregion Audio capture

  //#region Result handling
  /**
   * Handle a final recognition result from Vosk.
   * Buffers segments and delivers a merged result after a grace period,
   * matching the Azure plugin's segment-merging behavior.
   */
  private handleResult(message: ServerMessageResult): void {
    const text = message.result?.text;
    if (!text || text.trim().length === 0) {
      return;
    }

    const recoResult = this.convertResult(message);
    if (!recoResult) {
      return;
    }

    this._pendingResults.push(recoResult);

    // Reset grace timer
    if (this._graceTimer) {
      clearTimeout(this._graceTimer);
    }
    this._graceTimer = setTimeout(() => {
      this.flushPendingResults();
    }, this._gracePeriodMs);
  }

  /**
   * Handle a partial recognition result from Vosk.
   * Deduplicates identical consecutive partials to avoid flooding.
   */
  private handlePartialResult(message: ServerMessagePartialResult): void {
    const partial = message.result?.partial;
    if (partial && partial.trim().length > 0 && partial !== this._lastPartial) {
      this._lastPartial = partial;
      this.onRecognizing?.call(this, partial);
    }
  }

  /**
   * Convert a Vosk result message into an ISpeechRecoResult.
   *
   * vosk-browser in its standard mode returns a single hypothesis with word-level
   * detail (conf, start, end per word). We construct the n-best-like result structure
   * with the full text and an overall confidence derived from per-word confidences.
   */
  private convertResult(message: ServerMessageResult): SpeechRecoResult | null {
    const text = message.result?.text?.trim();
    if (!text || text.length === 0) {
      return null;
    }

    const words = message.result?.result;
    const recoResult = new SpeechRecoResult();

    // Compute timing from word-level details if available
    if (words && words.length > 0) {
      recoResult.startTime = this.addSecondsToDate(this._recoStart, words[0].start);
      recoResult.endTime = this.addSecondsToDate(this._recoStart, words[words.length - 1].end);

      // Overall confidence: geometric mean of per-word confidences
      const logSum = words.reduce((sum, w) => sum + Math.log(Math.max(w.conf, 1e-10)), 0);
      const confidence = Math.exp(logSum / words.length);

      recoResult.results.push(new SpeechRecoItem(text, confidence));

      // Add spelled-letter-to-acronym compaction, e.g. "l d l c" → "ldlc"
      const compacted = this.spelledLettersToAcronym(text);
      if (compacted !== null) {
        recoResult.results.push(new SpeechRecoItem(compacted, confidence * 0.9));
      }
    } else {
      // No word-level detail — use plain text with default confidence
      recoResult.startTime = this._recoStart;
      recoResult.endTime = new Date();
      recoResult.results.push(new SpeechRecoItem(text, 0.5));
    }

    return recoResult;
  }

  /**
   * Merge all buffered recognition segments into a single result and deliver
   * via onRecognized. Mirrors the Azure plugin's segment-merging behavior.
   */
  private flushPendingResults(): void {
    if (this._graceTimer) {
      clearTimeout(this._graceTimer);
      this._graceTimer = null;
    }

    const segments = this._pendingResults.splice(0);
    if (segments.length === 0) {
      return;
    }

    // Merge: concatenate result arrays, use earliest start / latest end
    const merged = new SpeechRecoResult();
    merged.results = segments
      .flatMap((s) => s.results)
      .sort((a, b) => b.confidence - a.confidence);
    merged.startTime = segments[0].startTime;
    merged.endTime = segments[segments.length - 1].endTime;

    this.onRecognized?.call(this, merged);
  }
  //#endregion Result handling

  //#region Utility
  /**
   * Compact spelled-out letters into acronyms.
   * "l d l c" → "ldlc"
   * "suspected i e d" → "suspected ied"
   * Returns null if no letter sequences were found.
   */
  private spelledLettersToAcronym(text: string): string | null {
    // Match sequences of single letters separated by spaces
    const pattern = /\b([a-zA-Z]\s)+[a-zA-Z]\b/g;
    if (!pattern.test(text)) {
      return null;
    }

    // Reset lastIndex after test()
    pattern.lastIndex = 0;
    const compacted = text.replace(pattern, (match) => {
      return match.replace(/\s/g, '');
    });

    return compacted !== text ? compacted : null;
  }

  /**
   * Add seconds to a Date.
   */
  private addSecondsToDate(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * 1000);
  }
  //#endregion Utility
}

/**
 * Recognition results - items recognized and time interval.
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
 * Recognition item, including recognized text and confidence.
 */
class SpeechRecoItem implements ISpeechRecoItem {
  text: string;
  confidence: number;
  constructor(text: string, confidence: number) {
    this.text = text;
    this.confidence = confidence;
  }
}
