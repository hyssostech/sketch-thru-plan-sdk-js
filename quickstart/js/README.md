# Quickstart: Add military symbols to Google Maps via Speech and Sketch

For a general description and code walkthrough, see the top level [README](../README.md).

## Script external references

Two cdn libraries are referenced in [`index.html`](index.html):

1. Microsoft's Cognitive Services Speech SDK - used by the speech plugin
1. STP SDK itself

```html
    <script type="application/javascript" src="https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@latest/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js"></script>
    <!-- The STP SDK needs to be added *after* the references to speech and communication services it may use -->
    <script type="application/javascript" src="https://cdn.jsdelivr.net/npm/sketch-thru-plan-sdk@0.3.1/dist/sketch-thru-plan-sdk-bundle-min.js"></script>
```

## App scripts

The quickstart code is organized in three distinct files, referenced as scripts in the html file:

```html
    <script type="application/javascript" src="googlemaps.js"></script>
    <script type="application/javascript" src="basicrenderer.js"></script>
    <script type="application/javascript" src="index.js"></script>
```

1. [`googlemaps.js`](googlemaps.js) contains the mapping code
1. [`basicrenderer.js`](basicrenderer.js) contains the bare bones placeholder renderer code
1. [`index.js'](index.js) contains the main STP code

