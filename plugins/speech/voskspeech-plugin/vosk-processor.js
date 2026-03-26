/**
 * AudioWorklet processor for Vosk speech recognition.
 * Captures microphone audio and forwards Float32 PCM frames to the main thread.
 * vosk-browser handles resampling internally via acceptWaveformFloat(),
 * so we pass the raw frames at the AudioContext's native sample rate.
 */
class VoskProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (input.length > 0 && input[0].length > 0) {
      // Post a copy of the first channel's Float32 data
      this.port.postMessage(input[0].slice());
    }
    return true;
  }
}

registerProcessor('vosk-processor', VoskProcessor);
