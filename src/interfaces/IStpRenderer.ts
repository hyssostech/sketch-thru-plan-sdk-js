export interface IStpRenderer {
  /**
   * Returns a GeoJSON Feature or FeatureCollection representing the symbol.
   * Implementations may enrich properties (e.g., rendering payloads, anchors).
   */
  asGeoJSON(): any;

  /**
   * Optional: Returns SVG renderings and metadata when available.
   * Implementations that do not support SVG can return null.
   */
  asSVG(): Array<any> | null;
}
