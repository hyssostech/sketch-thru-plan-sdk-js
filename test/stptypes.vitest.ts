import { describe, expect, it } from 'vitest';
import {
  DISCode,
  Interval,
  LatLon,
  Resource,
  Sidc,
  Size,
  StpSymbol
} from '../src/stptypes.ts';

describe('stptypes coverage', () => {
  it('Sidc part getters and charlie behave by delta length', () => {
    const sidc = new Sidc();

    sidc.delta = undefined;
    expect(sidc.partA).toBeUndefined();
    expect(sidc.partB).toBeUndefined();
    expect(sidc.partC).toBeUndefined();

    sidc.delta = '1234567890';
    expect(sidc.partA).toBe('1234567890');
    expect(sidc.partB).toBeUndefined();
    expect(sidc.partC).toBeUndefined();

    sidc.delta = '1234567890ABCDEFGHIJ';
    expect(sidc.partA).toBe('1234567890');
    expect(sidc.partB).toBe('ABCDEFGHIJ');
    expect(sidc.partC).toBeUndefined();

    sidc.delta = '1234567890ABCDEFGHIJKLMNOPQRST';
    expect(sidc.partA).toBe('1234567890');
    expect(sidc.partB).toBe('ABCDEFGHIJ');
    expect(sidc.partC).toBe('KLMNOPQRST');

    sidc.legacy = 'SFGPUCI----K';
    expect(sidc.charlie).toBe('SFGPUCI----K');
  });

  it('StpSymbol SIDC computed properties cover all branches', () => {
    const symbol = new StpSymbol();
    expect(symbol.deltaSIDC).toBeUndefined();
    expect(symbol.charlieSIDC).toBeUndefined();

    symbol.sidc = new Sidc();
    symbol.sidc.delta = '1234567890';
    expect(symbol.deltaSIDC).toBe('1234567890');

    symbol.sidc.delta = '1234567890ABCDEFGHIJ';
    expect(symbol.deltaSIDC).toBe('1234567890ABCDEFGHIJ');

    symbol.sidc.delta = '1234567890ABCDEFGHIJKLMNOPQRST';
    expect(symbol.deltaSIDC).toBe('1234567890ABCDEFGHIJKLMNOPQRST');

    symbol.sidc.legacy = 'LEGACY-CODE';
    expect(symbol.charlieSIDC).toBe('LEGACY-CODE');
  });

  it('deltaSIDC falls back to sidc.delta when sidc is a plain object (Object.assign)', () => {
    // Simulate what stprecognizer does: Object.assign from a plain JSON object
    const plain = { sidc: { delta: '10031000001211050000', legacy: 'SFGPUCI----K' } };
    const symbol = Object.assign(new StpSymbol(), plain);
    // sidc is a plain object, not a Sidc instance — getters like partA are missing
    expect(symbol.sidc).not.toBeInstanceOf(Sidc);
    // deltaSIDC should still return the delta value via the fallback
    expect(symbol.deltaSIDC).toBe('10031000001211050000');
    // charlieSIDC reads .legacy via charlie getter fallback
    expect(symbol.charlieSIDC).toBe('SFGPUCI----K');
  });

  it('Sidc.fromPlain reconstructs delta from partA/partB sent by engine', () => {
    // Engine sends partA, partB, legacy as direct properties (no delta)
    const plain = { partA: '1003100015', partB: '1211000000', symbolSet: '10', legacy: 'SFGPUCI----E---' };
    const sidc = Sidc.fromPlain(plain);
    expect(sidc).toBeInstanceOf(Sidc);
    expect(sidc.delta).toBe('10031000151211000000');
    expect(sidc.partA).toBe('1003100015');
    expect(sidc.partB).toBe('1211000000');
    expect(sidc.legacy).toBe('SFGPUCI----E---');
    expect(sidc.charlie).toBe('SFGPUCI----E---');
    expect(sidc.symbolSet).toBe('10');
  });

  it('Sidc.fromPlain preserves delta when already set', () => {
    const plain = { delta: '10031000151211000000', legacy: 'SFGPUCI----E---' };
    const sidc = Sidc.fromPlain(plain);
    expect(sidc.delta).toBe('10031000151211000000');
    expect(sidc.partA).toBe('1003100015');
    expect(sidc.partB).toBe('1211000000');
  });

  it('deltaSIDC works after Sidc.fromPlain hydration with engine data', () => {
    const plain = { sidc: { partA: '1003100015', partB: '1211000000', symbolSet: '10', legacy: 'SFGPUCI----E---' } };
    const symbol = Object.assign(new StpSymbol(), plain);
    symbol.sidc = Sidc.fromPlain(symbol.sidc as any);
    expect(symbol.deltaSIDC).toBe('10031000151211000000');
    expect(symbol.charlieSIDC).toBe('SFGPUCI----E---');
  });

  it('asGeoJSON handles point, line, area, multipoint and invalid geometry', () => {
    const symbol = new StpSymbol();
    symbol.poid = 'P1';

    expect(() => symbol.asGeoJSON()).toThrow('Coordinates are undefined or empty');

    symbol.location = { fsTYPE: 'point', coords: [new LatLon(10, 20)] } as any;
    const point = symbol.asGeoJSON();
    expect(point.geometry.type).toBe('Point');

    symbol.location = {
      fsTYPE: 'line',
      coords: [new LatLon(10, 20), new LatLon(11, 21)]
    } as any;
    const line = symbol.asGeoJSON();
    expect(line.geometry.type).toBe('LineString');

    symbol.location = {
      fsTYPE: 'area',
      coords: [new LatLon(10, 20), new LatLon(11, 21), new LatLon(12, 22), new LatLon(10, 20)]
    } as any;
    const area = symbol.asGeoJSON();
    expect(area.geometry.type).toBe('Polygon');

    symbol.location = {
      fsTYPE: 'multipoint',
      coords: [new LatLon(10, 20), new LatLon(11, 21)]
    } as any;
    const multi = symbol.asGeoJSON();
    expect(multi.geometry.type).toBe('MultiPoint');

    symbol.location = { fsTYPE: 'unknown', coords: [new LatLon(10, 20)] } as any;
    expect(() => symbol.asGeoJSON()).toThrow('Expected "point", "line", "area", or "multipoint" geometry type. Got: unknown');
  });

  it('asGeoJSON infers geometry when fsTYPE is missing but coordinates exist', () => {
    // Regression: a symbol re-added over a stale STP tombstone arrives with coords but no
    // location.fsTYPE. It must still render, not be dropped with "Coordinates are undefined or empty".
    const symbol = new StpSymbol();
    symbol.poid = 'P2';

    // Single coordinate, no fsTYPE -> Point
    symbol.location = { coords: [new LatLon(10, 20)] } as any;
    expect(symbol.asGeoJSON().geometry.type).toBe('Point');

    // Multiple coordinates, no fsTYPE -> LineString (not dropped)
    symbol.location = { coords: [new LatLon(10, 20), new LatLon(11, 21)] } as any;
    expect(symbol.asGeoJSON().geometry.type).toBe('LineString');

    // Empty-string fsTYPE behaves like missing
    symbol.location = { fsTYPE: '', coords: [new LatLon(10, 20)] } as any;
    expect(symbol.asGeoJSON().geometry.type).toBe('Point');
  });

  it('LatLon, Interval and Size equals support match and mismatch cases', () => {
    expect(new LatLon(1, 2).equals(new LatLon(1, 2))).toBe(true);
    expect(new LatLon(1, 2).equals(new LatLon(2, 1))).toBe(false);

    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-01T01:00:00Z');
    expect(new Interval(start, end).equals(new Interval(start, end))).toBe(true);
    expect(new Interval(start, end).equals(new Interval(end, start))).toBe(false);

    expect(new Size(10, 20).equals(new Size(10, 20))).toBe(true);
    expect(new Size(10, 20).equals(new Size(20, 10))).toBe(false);
  });

  it('DISCode equals returns false for undefined and compares all fields', () => {
    const left = new DISCode(1, 'US', 2, 3, 4, 5, 6);
    const same = new DISCode(1, 'US', 2, 3, 4, 5, 6);
    const different = new DISCode(1, 'US', 2, 3, 4, 5, 7);

    expect(left.equals(undefined as unknown as DISCode)).toBe(false);
    expect(left.equals(same)).toBe(true);
    expect(left.equals(different)).toBe(false);
  });

  it('Resource equals returns false for undefined and compares all fields', () => {
    const dis = new DISCode(1, 'US', 2, 3, 4, 5, 6);
    const left = new Resource('Fuel', 10, dis, 5, 7);
    const same = new Resource('Fuel', 10, dis, 5, 7);
    const different = new Resource('Fuel', 10, dis, 5, 8);

    expect(left.equals(undefined as unknown as Resource)).toBe(false);
    expect(left.equals(same)).toBe(true);
    expect(left.equals(different)).toBe(false);
  });
});
