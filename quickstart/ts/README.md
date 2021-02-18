# Quickstart: Add military symbols to Google Maps via Speech and Sketch

For a general description and code walkthrough, see the top level [README](../README.md).

## External references

Speech services SDK is referenced in [`index.html`](src/index.html):

* Microsoft's Cognitive Services Speech SDK - used by the speech plugin

```html
    <script type="application/javascript" src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js"></script>
```

The quickstart project already makes reference to the Sketch-thru-plan SDK npm package and the speech plugin. For new projects, it can be installed via `npm install` on an already initialized project:

```
npm install --save sketch-thru-plan-sdk
npm install --save @hyssostech/azurespeech-plugin
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
