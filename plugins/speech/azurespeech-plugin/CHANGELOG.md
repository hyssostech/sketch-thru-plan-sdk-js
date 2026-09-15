# Sketch-Thru-Plan Microsoft Cognitive Services Speech Plugin Change Log

## Version 0.3.5
- `uuid` `^13.0.0` -> `^14.0.2`, `agent-base` `^7.1.4` -> `^9.0.0`,
  `https-proxy-agent` `^7.0.6` -> `^9.1.0`. All three are runtime dependencies,
  so they change what is delivered to a consumer
- `cpx2` `^8.0.2` -> `^9.0.3` (build only)

## Version 0.3.4
- Consumes the SDK's own type declarations instead of a duplicated copy
- Fixes a `types` entry that never resolved
- Declares a `repository` field, which npm provenance requires
- Build output is no longer committed to the repository

## Version 0.3.3
- Version alignment only; no functional change

## Version 0.3.2
- Updated package versions

## Version 0.3.1
- Added `setPhraseList()` method that accepts an array of custom words/sentences that are given higher interpretation priority

## Version 0.3.0
- Bundling Microsoft Cognitive Service Speech SDK to avoid separate references on the client apps

## Version 0.2.0 - Wed Feb 17 2021
- Added support for continuous recognition, to provide extra control required for long duration sketches

## Version 0.1.0 - 
- Support for one-shot recognition