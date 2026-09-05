# Quickstart: Add military symbols to Leaflet via Speech and Sketch

For a general description and code walkthrough, see the top level [README](../README.md).

## Script external references

Leaflet and the app libraries are referenced in [`index.html`](index.html):

1. Leaflet CSS/JS
1. Microsoft's Cognitive Services Speech SDK – used by the speech plugin
1. STP SDK – available on jsDelivr
1. Azure Speech plugin

```html
    <!-- Leaflet Map -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <!-- Speech recognition -->
    <script src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js"></script>
    <!-- STP SDK and plugins - add after external services -->
    <script src="https://cdn.jsdelivr.net/npm/sketch-thru-plan-sdk@latest/dist/sketch-thru-plan-sdk-bundle-min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@hyssostech/azurespeech-plugin@latest/dist/stpazurespeech-bundle-min.js"></script>
```

## App scripts

The quickstart code is organized in three distinct files, referenced as scripts in the HTML file:

```html
    <script src="leaflet.js"></script>
    <script type="application/javascript" src="basicrenderer.js"></script>
    <script type="application/javascript" src="index.js"></script>
```

1. [`leaflet.js`](leaflet.js) contains the minimal Leaflet mapping code
1. [`basicrenderer.js`](basicrenderer.js) contains the bare bones placeholder renderer code
1. [`index.js'](index.js) contains the main STP code

