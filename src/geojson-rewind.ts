// TS version of @mapbox/geojson-rewind
export default function rewind(
  gj: GeoJSON.GeoJsonObject,
  outer: boolean
): GeoJSON.GeoJsonObject {
  let type = gj && gj.type,
    i;

  if (type === 'FeatureCollection') {
    let fc: GeoJSON.FeatureCollection = gj as GeoJSON.FeatureCollection;
    for (i = 0; i < fc.features.length; i++) rewind(fc.features[i], outer);
  } else if (type === 'GeometryCollection') {
    let gc: GeoJSON.GeometryCollection = gj as GeoJSON.GeometryCollection;
    for (i = 0; i < gc.geometries.length; i++) rewind(gc.geometries[i], outer);
  } else if (type === 'Feature') {
    let ft: GeoJSON.Feature = gj as GeoJSON.Feature;
    rewind(ft.geometry, outer);
  } else if (type === 'Polygon') {
    let pl: GeoJSON.Polygon = gj as GeoJSON.Polygon;
    rewindRings(pl.coordinates, outer);
  } else if (type === 'MultiPolygon') {
    let mp: GeoJSON.MultiPolygon = gj as GeoJSON.MultiPolygon;
    for (i = 0; i < mp.coordinates.length; i++)
      rewindRings(mp.coordinates[i], outer);
  }

  return gj;
}

function rewindRings(rings: GeoJSON.Position[][], outer: boolean) {
  if (rings.length === 0) return;

  rewindRing(rings[0], outer);
  for (let i = 1; i < rings.length; i++) {
    rewindRing(rings[i], !outer);
  }
}

function rewindRing(ring: GeoJSON.Position[], dir: boolean) {
  let area = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    area += (ring[i][0] - ring[j][0]) * (ring[j][1] + ring[i][1]);
  }
  if (area >= 0 !== !!dir) ring.reverse();
}
