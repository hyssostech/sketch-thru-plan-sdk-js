# Quickstart: Add military symbols to Leaflet via Speech and Sketch

For a general description and code walkthrough, see the top level [README](../README.md).

## External references

Leaflet and the Speech SDK are referenced in [`index.html`](src/index.html):

* Leaflet CSS/JS
* Microsoft's Cognitive Services Speech SDK – used by the speech plugin

```html
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js"></script>
```

The quickstart project already makes reference to the Sketch-thru-plan SDK npm package and the speech plugin. Install dependencies with npm and build - generated results are under `dist`:

```
npm install
npm run build 
```

For *new projects*, add `sketch-thru-plan-sdk` and `@hyssostech/azurespeech-plugin` to a project:

```
npm install --save sketch-thru-plan-sdk
npm install --save @hyssostech/azurespeech-plugin
```


## Source code organization

1. [`index.ts`](src/index.ts) contains the main STP code
1. [`leaflet.ts`](src/leaflet.ts) contains the minimal Leaflet mapping code
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
