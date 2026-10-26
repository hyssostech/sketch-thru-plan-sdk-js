import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  documentLines,
  lengthNorm,
  parseSymbolIndex,
  SymbolIndexUnavailableError,
  SymbolSearch,
  tokenize
} from '../src/symbolsearch.ts';
import { Porter2Stemmer } from '../src/porter2stemmer.ts';

/**
 * STP-1373: SearchSymbol answered by this SDK from a symbol index. The fixture index and the conformance cases
 * are the contract's own (json-api/symbol-search); every SDK answers them alike.
 */

type Json = Record<string, any>;
const dir = path.join(process.cwd(), 'json-api', 'symbol-search');
const fixtureText = fs.readFileSync(
  path.join(dir, 'fixture-index.json'),
  'utf8'
);
const CASES: Json = JSON.parse(
  fs.readFileSync(path.join(dir, 'cases.json'), 'utf8')
);
const byKey = (a: string, b: string): number => a.localeCompare(b);
const fixture = (): SymbolSearch =>
  SymbolSearch.fromIndex(fixtureText, 'fixture-index.json');

describe('SearchSymbol conformance (json-api/symbol-search/cases.json)', () => {
  for (const c of CASES.cases as Json[]) {
    it(c.name, () => {
      const results = fixture().search(
        c.text,
        c.maxResults ?? SymbolSearch.DEFAULT_MAX_RESULTS
      );
      const keys = results.map((r) => r.key);
      if (c.expectTop)
        expect(keys.slice(0, c.expectTop.length)).toEqual(c.expectTop);
      if (c.expectAll) expect(keys).toEqual(c.expectAll);
      if (c.expectSet)
        expect([...keys].sort(byKey)).toEqual([...c.expectSet].sort(byKey));
      if (c.expectFirst)
        for (const [field, value] of Object.entries(c.expectFirst))
          expect((results[0] as Json)[field]).toBe(value);
    });
  }
});

describe('the ranking', () => {
  it('gives descending scores in every answer', () => {
    const search = fixture();
    for (const text of [
      'zephyr',
      'zeph',
      'marble',
      'quill sparrow',
      'zephyr xylograph',
      'snare'
    ]) {
      const scores = search.search(text).map((r) => r.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    }
  });

  it('matches the exact phrase ignoring case and spacing', () => {
    const search = fixture();
    expect(search.search('  QUILL   sparrow ')[0].key).toBe('Q600');
    expect(search.search('quill sparrow')[0].speech).toBe('QUILL SPARROW');
  });

  it('refuses a cap below one', () => {
    expect(() => fixture().search('zephyr', 0)).toThrow(RangeError);
  });

  it('stores the length norm in one byte, as the classic index does', () => {
    // 1/sqrt(tokens) rounded down to the byte's few bits: documents of 3 and 4 tokens weigh the same.
    expect([1, 2, 3, 4, 100, 0].map(lengthNorm)).toEqual([
      1, 0.625, 0.5, 0.5, 0.09375, 0
    ]);
  });

  it('reads a code line as one word and splits a phrase at punctuation', () => {
    expect(tokenize('Start_10031000001211000000_End')).toEqual([
      'start_10031000001211000000_end'
    ]);
    expect(tokenize('Start_SFGPUCI--------_End')).toEqual([
      'start',
      'sfgpuci',
      'end'
    ]);
    expect(tokenize('Quill-Sparrow Mid')).toEqual(['quill', 'sparrow', 'mid']);
  });

  it('indexes the phrase pairs and triples, then the codes', () => {
    const lines = documentLines({
      key: 'K1',
      deltaSidc: '10031000001211000000',
      charlieSidc: '',
      symbolType: 'UNIT',
      name: 'Name',
      phrases: ['QUILL SPARROW'],
      gesture: 'point',
      defaultAffiliation: 'friend'
    });
    expect(lines).toEqual([
      'Start QUILL',
      'QUILL Mid',
      'Mid SPARROW',
      'SPARROW End',
      'Start QUILL Mid',
      'QUILL Mid SPARROW',
      'Mid SPARROW End',
      'Start_K1_End',
      'Start_10031000001211000000_End',
      'Start_10061000001211000000_End',
      'Start_10011000001211000000_End',
      'Start_10041000001211000000_End'
    ]);
  });
});

describe('the index', () => {
  it('refuses an index of another schema', () => {
    expect(() =>
      parseSymbolIndex('{"schema":"other","entries":[]}', 'x.json')
    ).toThrow(/^symbol index not available: x\.json \(schema is 'other'/);
  });

  it('refuses a key twice', () => {
    const json =
      '{"schema":"stp.symbol-index.v1","entries":[{"key":"A","phrases":["X"]},{"key":"A","phrases":["Y"]}]}';
    expect(() => parseSymbolIndex(json, 'x.json')).toThrow(
      "key 'A' appears twice"
    );
  });

  it('refuses text that is not JSON', () => {
    expect(() => parseSymbolIndex('{', 'x.json')).toThrow(
      SymbolIndexUnavailableError
    );
  });

  it('refuses a load without a URL until there is a default (STP-1383)', async () => {
    await expect(SymbolSearch.load()).rejects.toThrow(
      'symbol index not available: (no URL) (no URL given and no default yet)'
    );
    await expect(SymbolSearch.load('  ')).rejects.toBeInstanceOf(
      SymbolIndexUnavailableError
    );
  });

  it('loads over HTTP, and refuses a failed fetch with the contract message', async () => {
    const ok = await SymbolSearch.load('https://host/index.json', async () => ({
      ok: true,
      status: 200,
      text: async () => fixtureText
    }));
    expect(ok.search('zephyr')[0].key).toBe('F100');

    await expect(
      SymbolSearch.load('https://host/none.json', async () => ({
        ok: false,
        status: 404,
        text: async () => ''
      }))
    ).rejects.toThrow(
      'symbol index not available: https://host/none.json (HTTP 404)'
    );
    await expect(
      SymbolSearch.load('https://host/down.json', async () => {
        throw new Error('connection refused');
      })
    ).rejects.toThrow(
      'symbol index not available: https://host/down.json (connection refused)'
    );
  });
});

describe('the stemmer', () => {
  const pairs: [string, string][] = [
    ['caresses', 'caress'],
    ['ponies', 'poni'],
    ['cats', 'cat'],
    ['hopping', 'hop'],
    ['falling', 'fall'],
    ['hissing', 'hiss'],
    ['happy', 'happi'],
    ['sky', 'sky'],
    ['generously', 'generous'],
    ['communication', 'communic'],
    ['harbored', 'harbor'],
    ['canary', 'canari'],
    ['lanterns', 'lantern']
  ];
  for (const [word, stem] of pairs)
    it(`${word} -> ${stem}`, () =>
      expect(Porter2Stemmer.stem(word)).toBe(stem));
});
