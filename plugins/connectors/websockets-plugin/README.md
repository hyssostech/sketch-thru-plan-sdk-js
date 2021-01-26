# STP Plugin: Websockets connector

The Sketch-thru-Plan (STP) recognizer requires a connector configuration during initialization. This connection is used by the recognizer to send and receive messages/events to/from STP (see the [quicktstarts](../../quickstart)).

This plugin implements a Websockets-based connector. The STP server provides a native publish/subscribe mechanism, based on the Open Agent Architecture (OAA) framework, but other Websockets based mechanisms could be used on the server side as well.

## Accessing the plugin functionality

You can get the plugin from npm:

```
npm install --save @hyssostech/websockets-plugin
```

Or you can embed directly as a script using [`jsdelivr`](https://www.jsdelivr.com/package/npm/@hyssostech/websockets-plugin). As always, it is recommended that a specific version be used rather than `@latest` to prevent breaking changes from affecting existing code

```html
<!-- Include _after_ the external services such as the Microsoft Cognitive Services Speech -->
<script src="https://cdn.jsdelivr.net/npm/@hyssostech/websockets-plugin@latest/dist/stpconnector-bundle-min.js"></script>
```

## Referencing the plugin

The plugin is built as a `UMD` library, and is therefore compatible with plain vanilla (IIFE), AMD and CommonJS. Also included is an ESM bundle (`stpconnector-bundle.esm.js`).

When used in vanilla javascript, an `StpWS` exported global can be used to access the SDK types:

```javascript
const stpConn = new StpWS.StpWebSocketsConnector("wss://server.com:port");

```
In typescript, import `@hyssostech/websockets-plugin` after installing via npm:

```javascript
import * as StpWS from "@hyssostech/websockets-plugin";
const stpConn = new StpWS.StpWebSocketsConnector("wss://server.com:port");
```

Or import individual types:

```javascript
import { StpWebSocketsConnector } from "@hyssostech/websockets-plugin";
const stpConn = new StpWebSocketsConnector("wss://server.com:port");
```

## Quickstart example

This plugin is used in the [quicktstarts](../../../quickstart) to provide the main SDK object the means to communicate with STP.  


## Building the project

The repository includes a pre-built [`dist`](dist) folder that can be used directly for testing. If changes are made to the sample and there is a need to rebuild, run:

```
npm install
npm run build
```
