# C2SIM ArcGIS (TypeScript)

This sample mirrors the `samples/c2sim` functionality, but uses the ArcGIS map adapter (`ArcGISMap`) with ArcGIS Military Symbol Dictionary Renderer to draw single-point and multipoint military symbols.

## Prerequisites
- ArcGIS JS API is loaded on the page (handled by `index.html`).
- STP Engine reachable via WebSocket (e.g. `ws://localhost:9599`).

## Setup
From this folder:

```bash
npm install
npm run build
```

## Prerequisites
- ArcGIS API key.
- STP server URL, Azure Speech subscription (optional) configured via querystring or in `index.js`.

## Run
Open `index.html`. If ope via `file://`, the browser requires authorization for microphone access for each symbol. 
Use a server to avoid that (e.g. Vite - `npm run dev`).

Provide query params:
- `apikey`: ArcGIS API key to enable access to map data 
- `stpurl`: STP WebSocket URL
- `lat`, `lon`, `zoom`: map center and zoom
- `azkey`, `azregion`, `azlang`, `azendp`: Azure Speech settings
- `mil2525StyleUrl` or `milstyleurl` (alias): Optional ArcGIS Military Dictionary style URL
- `mil2525PortalItemId` or `milstyle` (alias): Optional ArcGIS portal item ID for Military Dictionary

Example:
```
http://localhost:8080/samples/c2sim-arcgis/index.html?apikey=<your ArcGIS API key>&stpurl=ws://localhost:9599&lat=34.05&lon=-118.24&zoom=12
```
