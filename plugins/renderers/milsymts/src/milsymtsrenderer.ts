/*
 * MilsymTsRenderer: side-by-side multipoint renderer using mil-sym-ts WebRenderer when available.
 * Fallback to existing JmsRenderer for points and when WebRenderer is not present.
 */

import * as MilSymTsWeb from '@armyc2.c5isr.renderer/mil-sym-ts-web';
import { IStpRenderer } from '../../interfaces/IStpRenderer';

declare global {
  interface Window { WebRenderer?: any; milSymTS?: any; JmsRenderer?: any; }
}

// Attach imported WebRenderer to browser global if present
const ImportedWR: any = (MilSymTsWeb as any)?.WebRenderer;
if (typeof window !== 'undefined' && ImportedWR) {
  (window as any).WebRenderer = (window as any).WebRenderer || ImportedWR;
  (window as any).milSymTS = (window as any).milSymTS || { WebRenderer: ImportedWR };
}

// Minimal shape typing for STP symbols
interface LatLonLike { lat?: number; lon?: number; x?: number; y?: number; }
interface BoundsLike { east?: number; west?: number; north?: number; south?: number; }
interface LocationLike { shape?: string; coords?: LatLonLike[]; centroid?: LatLonLike; }
interface SidcLike { legacy?: string; partA?: string; partB?: string; symbolSet?: string; }
interface SymbolLike {
  poid?: string; fsTYPE?: string; sidc?: SidcLike; affiliation?: string; parent?: string;
  designator1?: string; designator2?: string; status?: string; modifier?: string; strength?: string;
  timeFrom?: string; timeTo?: string; altitude?: number; minAltitude?: number; maxAltitude?: number;
  fullDescription?: string; location?: LocationLike;
}

// GeoJSON helpers
type Position = [number, number];
interface Feature { type: 'Feature'; geometry: { type: string; coordinates: any }; properties: Record<string, any>; }
interface FeatureCollection { type: 'FeatureCollection'; features: Feature[] }

function toPosition(ll: LatLonLike): Position { const lon = (ll.lon ?? ll.x ?? 0); const lat = (ll.lat ?? ll.y ?? 0); return [lon, lat]; }
function closeRing(coords: Position[]): Position[] { if (coords.length > 0) { const f = coords[0], l = coords[coords.length - 1]; if (f[0] !== l[0] || f[1] !== l[1]) coords.push([...f]); } return coords; }
function symbolProps(symbol: SymbolLike): Record<string, any> { return { poid: symbol.poid, sidc: symbol.sidc?.legacy ?? symbol.sidc, fullDescription: symbol.fullDescription, fsTYPE: symbol.fsTYPE, affiliation: symbol.affiliation, status: symbol.status }; }

function renderWithWebRenderer(symbol: SymbolLike, bounds?: BoundsLike): FeatureCollection | null {
  try {
    const WR = (window as any).WebRenderer || (window as any).milSymTS?.WebRenderer;
    if (!WR) return null;
    const wr = new WR();
    if (typeof wr.renderGeoJSON === 'function') { return wr.renderGeoJSON(symbol, bounds) as FeatureCollection; }
    if (typeof wr.render === 'function') {
      const result = wr.render(symbol, bounds);
      if (result && Array.isArray(result.paths)) {
        const features: Feature[] = [];
        for (const p of result.paths) {
          const coords: Position[] = Array.isArray(p.points) ? p.points.map((pt: any) => toPosition({ lon: pt.lon ?? pt.x, lat: pt.lat ?? pt.y })) : [];
          const isClosed = p.closed === true || (coords.length > 2 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]);
          if (isClosed) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closeRing(coords)] }, properties: symbolProps(symbol) });
          else features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: symbolProps(symbol) });
        }
        return { type: 'FeatureCollection', features };
      }
    }
  } catch { /* ignore */ }
  return null;
}

export class MilsymTsRenderer implements IStpRenderer {
  private symbol: SymbolLike; private bounds?: BoundsLike;
  constructor(symbol: SymbolLike, bounds?: BoundsLike) { this.symbol = symbol; this.bounds = bounds; }
  public asGeoJSON(): any {
    const shape = this.symbol?.location?.shape;
    const props = symbolProps(this.symbol);

    // Handle point shapes without any dependency on JmsRenderer
    if (!shape || shape === 'point') {
      const centroid = this.symbol?.location?.centroid || (this.symbol?.location?.coords?.[0]);
      if (!centroid) return { type: 'FeatureCollection', features: [] };
      const pt: Feature = { type: 'Feature', geometry: { type: 'Point', coordinates: toPosition(centroid) }, properties: props };
      return { type: 'FeatureCollection', features: [pt] };
    }

    // Try mil-sym-ts WebRenderer for multipoints first
    const webGJ = renderWithWebRenderer(this.symbol, this.bounds);
    if (webGJ) return webGJ;

    // Fallback: shallow conversion from coords
    const coords = (this.symbol?.location?.coords ?? []).map(toPosition);
    let feature: Feature;
    switch (shape) {
      case 'polyline':
      case 'line':
        feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: props };
        break;
      case 'polygon':
      case 'area':
      case 'rectangle':
      case 'ellipse':
        feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [closeRing(coords)] }, properties: props };
        break;
      default:
        feature = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: props };
        break;
    }
    return { type: 'FeatureCollection', features: [feature] };
  }

  // Optional SVG rendering not supported in this implementation
  public asSVG(): Array<any> | null {
    return null;
  }
}

// Expose globally for iife bundles
;(window as any).MilsymTsRenderer = MilsymTsRenderer;
