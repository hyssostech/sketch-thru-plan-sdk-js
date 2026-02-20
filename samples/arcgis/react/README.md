# C2SIM ArcGIS – React Sample

React wrapper around the proven `c2sim-arcgis` logic.  The app renders the same
toolbar / message-bar / map UI, but the HTML shell is managed by React while all
STP, speech, and ArcGIS map logic is preserved in `stp-app.ts` — kept
deliberately close to the original `index.ts` so nothing breaks.

## Quick start

```bash
npm install
npm run dev        # Vite dev-server with HMR
```

Open the URL printed by Vite (usually `http://localhost:5173`) and append the
same query-string parameters used by `c2sim-arcgis`:

| Param | Purpose |
|---|---|
| `stpurl` | STP WebSocket URL |
| `lat`, `lon`, `zoom` | Map centre & zoom |
| `azkey`, `azregion`, `azlang`, `azendp` | Azure Speech settings |
| `mil2525StyleUrl` / `milstyleurl` | MIL-STD-2525 dictionary style URL |
| `mil2525PortalItemId` / `milstyle` | ArcGIS portal item ID for MIL-STD-2525 |
| `mapkey` | ArcGIS API key |
| `inkonly` | Disable speech (ink only) |
| `machineid` | Machine identifier |

## Production build

```bash
npm run build      # outputs to dist/
npm run preview    # local preview of the production build
```

## Architecture

```
index.html          – loads global SDKs (ArcGIS, STP, Azure Speech) via <script>
src/
  main.tsx          – React entry point
  App.tsx           – React component (toolbar + map div)
  stp-app.ts        – STP / map logic (≈ original index.ts, exported as startStpApp())
  styles.css        – same styles as the vanilla sample
```

The deliberate design choice is a **thin React shell**: React owns the DOM
structure and the message bar state; everything else runs imperatively through
the same `getElementById`-based wiring that was already working.
