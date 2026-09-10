# Sketch-thru-Plan Javascript SDK

This repository hosts the Hyssos Tech Sketch-Thru-Plan (STP) Natural Language Planning Engine SDK for JavaScript/TypeScript, published to npm as [`sketch-thru-plan-sdk`](https://www.npmjs.com/package/sketch-thru-plan-sdk), together with the developer resources (quickstart, samples, JSON API and plugins) that illustrate its use.

## Sketch-thru-Plan

Sketch-thru-Plan (STP) is a Natural Language Planning Engine that analyzes combined speech and sketches and produces interpretations of user intentions in terms of symbols placed on a map, and higher-level constructs that correlate multiple symbols into intended actions (or tasks).

STP is a *multimodal* system - it produces interpretations based on multiple kinds of user input, most commonly speech and sketch. The interpretations fuse these modalities, for example, identifying a location from the sketch, and the intended semantics from the speech, for instance when a user sketches a line and says "phase line blue". The interpretation of multiple modalities also makes the recognizer more robust through *mutual disambiguation* - if there is high confidence for example that the user sketched an area, rather than a line, then those speech hypotheses that are known to refer to areas are considered more likely, even if they did not rank too well as an independent interpretation of the speech.

STP is a generic engine, which can be configured to provide interpretations in multiple domains. The primary area of application is military planning, supporting fast creation of Courses of Action (COAs). STP enhances user cognition by letting them focus on the creative aspect of planning, keeping focus on the task, not the tool.

Plans designed in STP are executable with little additional user intervention other than the symbol laydown using speech and sketch. The resulting plans are ready to be sent to simulators for adjudication, and to Command and Control (C2) systems.

## Prerequisites

* Sketch-thru-Plan (STP) Engine (v5.9.9+) running on an accessible Windows server or locally (for development)
* Most samples will require a PC or Mac with a working microphone, mouse or stylus

## Accessing the SDK functionality

You can get the SDK from npm:

```
npm install --save sketch-thru-plan-sdk
```

Or you can embed directly as a script using [`jsdelivr`](https://www.jsdelivr.com/package/npm/sketch-thru-plan-sdk). As always, it is recommended that a specific version be used rather than `@latest` to prevent breaking changes from affecting existing code:

```html
<!-- Include _after_ the external services such as the Microsoft Cognitive Services Speech -->
<script src="https://cdn.jsdelivr.net/npm/sketch-thru-plan-sdk@latest/dist/sketch-thru-plan-sdk-bundle-min.js"></script>
```

## Referencing the SDK

The SDK is built as a `UMD` library, and is therefore compatible with plain vanilla (IIFE), AMD and CommonJS. Also included is an ESM bundle (`sketch-thru-plan-sdk-bundle.esm.js`).

When used in vanilla javascript, an `StpSDK` exported global can be used to access the SDK types:

```javascript
const stpsdk = new StpSDK.StpRecognizer(stpconn);
```

In typescript, import `sketch-thru-plan-sdk` after installing via npm:

```javascript
import * as StpSDK from "sketch-thru-plan-sdk";
const stpsdk = new StpSDK.StpRecognizer(stpconn);
```

Or import individual types:

```javascript
import { StpWebSocketsConnector, StpRecognizer, StpSymbol } from "sketch-thru-plan-sdk";
const stpsdk = new StpRecognizer(stpconn);
```

## Building the SDK

The SDK source lives under [`src`](src), with tests under [`test`](test).

```
npm install        # install dependencies
npm run build      # clean, compile (tsc) and bundle (rollup) into dist/
npm test           # run the vitest test suite
npm run test:coverage
npm run build:docs # generate typedoc API documentation
```

See [`CHANGELOG.md`](CHANGELOG.md) for the version history and [`resources.md`](resources.md) for the publish checklist and developer notes.

## Building

The samples, quickstart and plugins are a **developer artifact you build first**.
Plugin bundles are generated, not committed, so a fresh clone does not contain
them:

```
npm ci
npm run build:all
```

`build:all` builds the SDK and then every plugin (`npm run build --workspaces`).
Build the SDK alone with `npm run build`, the plugins alone with
`npm run build:plugins`.

Opening a sample page straight from a fresh clone, without building, will fail
to load its plugin bundles.

## Getting started

The [quickstart](quickstart) folder contains introductory examples.

## Samples

The [samples](samples) folder contains examples covering particular aspects of the SDK.

## JSON API

Describes the [JSON API](json-api) that is wrapped by the SDK.

## Plugins and reusable components

Components that can be swapped and/or reused are described in [plugins](plugins):

a. Speech recognition using the Microsoft Cognitive Services Speech recognizer - `@hyssostech/azurespeech-plugin` - <https://www.npmjs.com/package/@hyssostech/azurespeech-plugin>

b. Connection to STP via WebSockets - built into the SDK as `StpWebSocketsConnector`.
The former `@hyssostech/websockets-plugin` package duplicated that class and is retired;
use the SDK export directly.

## Reference

[Sketch-Thru-Plan SDK Documentation](https://hyssostech.github.io/stp-docs/)

[API Reference](https://hyssostech.github.io/stp-docs/docs/api/)

[MIL-STD-2525D Joint Military Symbology](https://www.jcs.mil/Portals/36/Documents/Doctrine/Other_Pubs/ms_2525d.pdf)
