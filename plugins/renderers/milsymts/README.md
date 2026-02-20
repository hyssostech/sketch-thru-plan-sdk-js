# Rendering

The `MilsymTsRenderer` is a standalone, browser‑ready renderer for MIL‑STD‑2525D/E military symbols tailored to Sketch‑thru‑Plan (STP). It focuses on:

- Multipoint tactical graphics (lines/areas): high‑fidelity GeoJSON geometries produced via Mission Command’s TypeScript web renderer.
- Single‑point symbols: returned as plain GeoJSON points; no SVG icon or label overlays (use `JmsRenderer` if you need SVG, anchors, and hit‑shapes).

This renderer enriches STP’s base GeoJSON (`symbol.asGeoJSON()`) with consistent properties to drive map styling and interactions (e.g., `poid`, `sidc`, `affiliation`, `status`). Complex TGs render as `FeatureCollection` when multiple geometries are required.

Engine:

* [Mission Command mil‑sym‑ts‑web](https://github.com/missioncommand/mil-sym-ts) provides the multipoint renderer (`WebRenderer`) used to compute tactical graphic geometries.

Usage: include the single milsymts renderer bundle. No separate `mil‑sym‑ts‑web` script tag is required; it is bundled by the build. See the [samples](../../samples).

```html
<!-- MilsymTs multipoint renderer -->
<script src="../../plugins/renderers/milsymts/dist/milsymtsrenderer-bundle.js"></script>
```

Notes:

- Outputs GeoJSON with `[lon, lat]` coordinate order, preserving STP symbol properties.
- Returns `FeatureCollection` for complex tactical graphics; simple lines/areas as `Feature`.
- `asSVG()` is not implemented and returns `null` (use `JmsRenderer` for SVG single‑point rendering with labels and hit‑shapes).
