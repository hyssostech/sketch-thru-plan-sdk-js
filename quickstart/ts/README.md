# Quickstart: Add military symbols to Google Maps via Speech and Sketch

For a general description and code walkthrough, see the top level [README](../README.md).

## Script external references

Two cdn libraries are referenced in [`index.html`](src/index.html):

1. Microsoft's Cognitive Services Speech SDK - used by the speech plugin
1. STP SDK itself

```html
    <script type="application/javascript" src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js"></script>
    <!-- The STP SDK needs to be added *after* the references to speech and communication services it may use -->
    <script type="application/javascript" src="https://cdn.jsdelivr.net/npm/sketch-thru-plan-sdk@0.3.1/dist/sketch-thru-plan-sdk-bundle-min.js"></script>
```

## Source code organization

1. [`index.ts'](src/index.ts) contains the main STP code
1. [`googlemaps.ts`](src/googlemaps.ts) contains the mapping code
1. [`basicrenderer.ts`](src/basicrenderer.ts) contains the bare bones placeholder renderer code

## Building the typescript project

The repository includes a pre-built [`dist`](dist) folder that can be used directly for testing. If changes are made to the sample and there is a need to rebuild, change to the `quickstart/ts` directory and run:

```
npm install
npm run build
```

To rebuild with an updated version of the STP SDK:

```
npm update
npm run build
```
