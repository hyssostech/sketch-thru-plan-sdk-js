# Rendering

The `JmsRenderer` provides a complete, browser-ready renderer for MIL‑STD‑2525C symbols tailored to Sketch‑thru‑Plan (STP). It focuses on:

- Single‑point symbols (units, equipment, MOOTW, point TGs): crisp SVG icons with anchors and clickable hit‑shapes.
- Multipoint tactical graphics (lines/areas): high‑fidelity GeoJSON geometries produced by Mission Command’s multipoint renderer.

This renderer composes open‑source engines inside the custom [`jmsrenderer.ts`](src/jmsrenderer.ts) and enriches STP’s base GeoJSON (`symbol.asGeoJSON()`) with:

- SVG label overlays (size, outline, rotation), precise anchor point, and hit‑shape polygon for selection.
- Geometry collections for complex TGs; line/area segmentation as needed.
- Consistent properties (`poid`, `sidc`, `affiliation`, `status`, and more) to drive map styling and interactions.

This renderer combines capabilities of two open source renderers, weaved together with custom SVG label generation:

* [Spatial Illusions milsymbol](https://github.com/spatialillusions/milsymbol) renders single‑point symbols to SVG, including anchors and hit‑shapes.
* [Mission Command mil‑sym‑js](https://github.com/missioncommand/mil-sym-ts/wiki/2525C-Renderer-Overview) renders multipoint tactical graphics to GeoJSON.

In addition, `JmsRenderer` adds robust SVG label rendering (font, outline, rotation) and anchor/hit‑shape computation not available in the baseline multipoint renderer.


The multipoint renderer (`mil‑sym‑js`) supports multiple build flavors. The local [mil-sym-js.js](src/mil-sym-js.js) is a bundled copy of the recommended flavor and is included as a side‑effect in the output bundle.

Usage: include the single JMS renderer bundle. See the [samples](../../samples).

```html
<script src="../../plugins/renderers/milsymjs/dist/jmsrenderer-bundle.js"></script>
```

