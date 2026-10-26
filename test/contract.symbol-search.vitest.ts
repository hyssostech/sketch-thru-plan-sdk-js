import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * STP-1373. SearchSymbol is answered by the SDK itself, from a symbol index it loads - the engine never
 * receives it ("x-layer": "client"). The contract fixes the call and the result; the index format is
 * sketch-thru-plan-symbol-index.schema.json; the invented fixture index and the cases are what every SDK's
 * ranker runs against, so the SDKs answer alike. The real index (STP's speech vocabulary) is not public and
 * ships with STP; nothing here is taken from it.
 */

type Json = Record<string, any>;
const dir = path.join(process.cwd(), 'json-api');
const read = (...p: string[]): Json =>
  JSON.parse(fs.readFileSync(path.join(dir, ...p), 'utf8'));
const CONTRACT = read('sketch-thru-plan-api.json');
const INDEX_SCHEMA = read('sketch-thru-plan-symbol-index.schema.json');
const FIXTURE = read('symbol-search', 'fixture-index.json');
const CASES = read('symbol-search', 'cases.json');
const method = (): Json =>
  CONTRACT.methods.find((m: Json) => m.name === 'SearchSymbol');
const RESULT_FIELDS = [
  'key',
  'deltaSidc',
  'charlieSidc',
  'name',
  'speech',
  'gesture',
  'defaultAffiliation',
  'score'
];

describe('SearchSymbol in the contract (STP-1373)', () => {
  it('is a read method the SDK answers itself', () => {
    const m = method();
    expect(m).toBeDefined();
    expect(m['x-layer']).toBe('client');
    expect(m['x-stpSafety']).toBe('read');
    expect(m['x-stpEmits']).toEqual([]);
  });

  it('takes the text and an optional result cap', () => {
    const params = method().params.map((p: Json) => [
      p.name,
      p.required === true,
      p.schema.type
    ]);
    expect(params).toEqual([
      ['text', true, 'string'],
      ['maxResults', false, 'integer']
    ]);
  });

  it('answers ranked results carrying what the ticket lists', () => {
    const m = method();
    expect(m.result.name).toBe('results');
    expect(m.result.schema.items.$ref).toBe(
      '#/components/schemas/SymbolSearchResult'
    );
    const schema = CONTRACT.components.schemas.SymbolSearchResult;
    expect(Object.keys(schema.properties).sort()).toEqual(
      [...RESULT_FIELDS].sort()
    );
    expect(schema.required.sort()).toEqual([...RESULT_FIELDS].sort());
    expect(schema.properties.defaultAffiliation.enum).toEqual([
      'friend',
      'hostile'
    ]);
  });

  it('refuses, rather than answering empty, when the SDK has no index', () => {
    const cases: Json[] = method()['x-stpEdgeCases'];
    const missing = cases.find((c) => /index/.test(c.when));
    expect(missing?.outcome).toBe('refused');
    expect(missing?.message).toMatch(/index/);
  });

  it('documents the client layer beside transport', () => {
    const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
    expect(readme).toMatch(/"x-layer": "client"/);
  });
});

describe('the symbol index format and the shared fixture (STP-1373)', () => {
  const ENTRY_FIELDS = [
    'key',
    'deltaSidc',
    'charlieSidc',
    'symbolType',
    'name',
    'phrases',
    'gesture',
    'defaultAffiliation'
  ];

  it('pins schema stp.symbol-index.v1 and the entry fields', () => {
    expect(INDEX_SCHEMA.properties.schema.const).toBe('stp.symbol-index.v1');
    const entry = INDEX_SCHEMA.properties.entries.items;
    expect(entry.required.sort()).toEqual([...ENTRY_FIELDS].sort());
    expect(entry.additionalProperties).toBe(false);
  });

  it('has a fixture index that is valid against it', () => {
    expect(FIXTURE.schema).toBe('stp.symbol-index.v1');
    const keys: string[] = FIXTURE.entries.map((e: Json) => e.key);
    expect([...keys].sort()).toEqual(keys); // ordered by key, as the generator writes it
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of FIXTURE.entries as Json[]) {
      expect(Object.keys(e).sort()).toEqual([...ENTRY_FIELDS].sort());
      expect(e.deltaSidc).toMatch(/^\d{20}$/);
      expect(e.charlieSidc === '' || /^[A-Z-]{15}$/.test(e.charlieSidc)).toBe(
        true
      );
      expect(e.phrases.length).toBeGreaterThan(0);
      expect(['friend', 'hostile']).toContain(e.defaultAffiliation);
    }
  });

  it('has cases that name only fixture entries', () => {
    const keys = new Set(FIXTURE.entries.map((e: Json) => e.key));
    expect(CASES.cases.length).toBeGreaterThan(0);
    for (const c of CASES.cases as Json[]) {
      expect(typeof c.name).toBe('string');
      expect(typeof c.text).toBe('string');
      for (const k of [...(c.expectTop ?? []), ...(c.expectAll ?? [])])
        expect(keys.has(k)).toBe(true);
    }
  });
});
