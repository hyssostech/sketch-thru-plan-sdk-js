import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  documentLines,
  lengthNorm,
  parseSymbolIndex,
  SymbolIndexUnavailableError,
  SymbolSearch,
  tokenize,
  symbolIndexUrlFor,
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

  // STP-1383: with no URL, load() reads the index the STP bridge serves on its own port.
  const served = (urls: string[]) => async (u: string) => {
    urls.push(u);
    return { ok: true, status: 200, text: async () => fixtureText };
  };

  it('with no URL and no connected STP refuses, fetching nothing (STP-1383)', async () => {
    SymbolSearch.connectedIndexUrl = undefined;
    const urls: string[] = [];
    for (const none of [undefined, '  ']) {
      const err = await SymbolSearch.load(none, served(urls)).catch((e) => e);
      expect(err).toBeInstanceOf(SymbolIndexUnavailableError);
      expect(err.message).toBe(
        'symbol index not available: (no URL) (no URL given and no STP connected; connect first or pass a URL)'
      );
    }
    expect(urls).toEqual([]);
  });

  it('with no URL uses the bridge of the last connected connector; an explicit URL wins', async () => {
    SymbolSearch.connectedIndexUrl = symbolIndexUrlFor('wss://stp.example:19599/session-7');
    const urls: string[] = [];
    await SymbolSearch.load(undefined, served(urls));
    await SymbolSearch.load('https://host/index.json', served(urls));
    expect(urls).toEqual([
      'https://stp.example:19599/symbol-index.json',
      'https://host/index.json'
    ]);
    SymbolSearch.connectedIndexUrl = undefined;
  });

  it('derives the index URL from a bridge connection string', () => {
    expect(symbolIndexUrlFor('ws://localhost:9599')).toBe('http://localhost:9599/symbol-index.json');
    expect(symbolIndexUrlFor('wss://h.example:443/abc?x=1')).toBe('https://h.example/symbol-index.json');
    expect(symbolIndexUrlFor('ws://127.0.0.1:19599/')).toBe('http://127.0.0.1:19599/symbol-index.json');
    expect(symbolIndexUrlFor('https://not-a-bridge.example')).toBeUndefined();
    expect(symbolIndexUrlFor('nonsense')).toBeUndefined();
  });

  it('explains an STP that does not serve the index, never answering empty', async () => {
    SymbolSearch.connectedIndexUrl = symbolIndexUrlFor('ws://localhost:9599');
    // an older bridge drops a plain HTTP request
    await expect(
      SymbolSearch.load(undefined, async () => {
        throw new Error('fetch failed');
      })
    ).rejects.toThrow(
      'symbol index not available: http://localhost:9599/symbol-index.json (fetch failed; this STP does not serve the symbol index; STP 5.11.2 or later serves it at /symbol-index.json on its WebSocket port, or pass the URL of a symbol-index.json)'
    );
    // or answers the non-upgrade request with an error status
    await expect(
      SymbolSearch.load(undefined, async () => ({ ok: false, status: 426, text: async () => '' }))
    ).rejects.toThrow('(HTTP 426; this STP does not serve the symbol index;');
    SymbolSearch.connectedIndexUrl = undefined;
  });

  it("reports STP's own 'not installed' answer with where it looked", async () => {
    await expect(
      SymbolSearch.load('http://localhost:9599/symbol-index.json', async () => ({
        ok: false,
        status: 404,
        text: async () =>
          '{"error":"symbol index not installed","expected":"/opt/stp/Presenter/Tools/SicListIndex/symbol-index.json"}'
      }))
    ).rejects.toThrow(
      '(HTTP 404: symbol index not installed (expected at /opt/stp/Presenter/Tools/SicListIndex/symbol-index.json))'
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
