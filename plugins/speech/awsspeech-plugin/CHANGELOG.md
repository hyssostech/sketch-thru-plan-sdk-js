# Sketch-Thru-Plan Amazon Transcribe Streaming Speech Plugin Change Log

## Version 0.1.0
- Initial release
- Support for one-shot recognition (`recognizeOnce`)
- Support for continuous recognition (`startRecognizing` / `stopRecognizing`)
- Microphone capture via Web Audio API with PCM encoding
- Bundled `@aws-sdk/client-transcribe-streaming` (no separate CDN script needed)
- Acronym expansion hypotheses (matching Azure plugin behavior)
