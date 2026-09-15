# Sketch-Thru-Plan Amazon Transcribe Streaming Speech Plugin Change Log

## Version 0.1.2
- `@aws-sdk/client-transcribe-streaming` moved from `^3.998.0` to `^3.1130.0`
- Declares a `files` array, so the built `dist/` cannot be dropped at pack time.
  Without it, npm falls back to the repository ignore rules when deciding what
  to pack - which is how two sibling plugins published tarballs containing
  TypeScript source, rollup config and no built output at all, with every signal
  green. This plugin was not broken by that, but it was exposed to it
- Build output is no longer committed to the repository; it is built on demand

## Version 0.1.1
- Consumes the SDK's own type declarations instead of a duplicated copy, so the
  plugin and the SDK can no longer disagree about a type
- Declares a `repository` field, which npm provenance requires

## Version 0.1.0
- Initial release
- Support for one-shot recognition (`recognizeOnce`)
- Support for continuous recognition (`startRecognizing` / `stopRecognizing`)
- Microphone capture via Web Audio API with PCM encoding
- Bundled `@aws-sdk/client-transcribe-streaming` (no separate CDN script needed)
- Acronym expansion hypotheses (matching Azure plugin behavior)
