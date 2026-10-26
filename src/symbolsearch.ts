import { Porter2Stemmer } from './porter2stemmer';

/**
 * SearchSymbol (STP-1373): the symbols whose spoken phrases match a typed text, best first, answered from a
 * symbol index the SDK is given - the engine is never asked (contract `"x-layer": "client"`).
 *
 * The index is not part of this SDK: STP generates it from its symbol tables and ships it with STP
 * (json-api/sketch-thru-plan-symbol-index.schema.json, `stp.symbol-index.v1`). Hand it over with
 * {@link SymbolSearch.fromIndex} or let {@link SymbolSearch.load} fetch it. A missing or unreadable index is a
 * {@link SymbolIndexUnavailableError}, never an empty answer.
 *
 * The ranking is STP's own symbol search, so every SDK lists what STP lists: each symbol is indexed as STP
 * indexes it (word pairs and triples of each phrase between start / mid / end markers, plus its codes, stemmed
 * with {@link Porter2Stemmer}), and a text is searched in passes - exactly, as prefixes, by stem, by stem prefix,
 * then within edits - all its words required; the first pass that finds anything answers, ordered by the
 * classic tf-idf relevance score. Words that find nothing together are searched one by one and the results
 * merged. Equal scores rank by key. One rule departs from STP (operator's ruling, 2026-10-26): an entry whose
 * phrase is exactly the text ranks first. The arithmetic is the .NET SDK's, single precision where it is, so
 * both SDKs rank alike.
 */

/** One symbol of the index. */
export interface SymbolIndexEntry {
  key: string;
  deltaSidc: string;
  charlieSidc: string;
  symbolType: string;
  name: string;
  phrases: string[];
  gesture: string;
  defaultAffiliation: string;
}

/** One answer - the contract's `SymbolSearchResult`. */
export interface SymbolSearchResult {
  key: string;
  deltaSidc: string;
  charlieSidc: string;
  name: string;
  /** The phrase that matched. */
  speech: string;
  gesture: string;
  defaultAffiliation: string;
  /** The ranking score, higher first; comparable only within one answer. */
  score: number;
}

/** The symbol index could not be read: the contract's refusal, `symbol index not available: <source> (<reason>)`. */
export class SymbolIndexUnavailableError extends Error {
  constructor(
    readonly source: string,
    readonly reason: string
  ) {
    super(`symbol index not available: ${source} (${reason})`);
    this.name = 'SymbolIndexUnavailableError';
  }
}

/** The `schema` value this SDK reads. */
export const SYMBOL_INDEX_SCHEMA = 'stp.symbol-index.v1';

/** The path STP serves the installed index at, on its WebSocket bridge port (STP-1383). */
export const SYMBOL_INDEX_PATH = '/symbol-index.json';

/** The default when no connector has connected: STP's local bridge on its default port (STP-1383). */
export const DEFAULT_SYMBOL_INDEX_URL =
  'http://localhost:9599' + SYMBOL_INDEX_PATH;

/**
 * The symbol index URL for a bridge connection string: `ws:` becomes `http:`, `wss:` becomes `https:`, same host and
 * port; any path (e.g. a session suffix) is dropped. Undefined when `connstring` is not a ws/wss URL.
 */
export function symbolIndexUrlFor(connstring: string): string | undefined {
  let u: URL;
  try {
    u = new URL(connstring.trim());
  } catch {
    return undefined;
  }
  const scheme =
    u.protocol === 'ws:'
      ? 'http:'
      : u.protocol === 'wss:'
        ? 'https:'
        : undefined;
  return scheme === undefined
    ? undefined
    : `${scheme}//${u.host}${SYMBOL_INDEX_PATH}`;
}

/** What an STP that does not serve the index (older than the route) looks like to the caller. */
const OLDER_STP =
  'this STP does not serve the symbol index; STP 5.11.2 or later serves it at ' +
  SYMBOL_INDEX_PATH +
  ' on its WebSocket port, or pass the URL of a symbol-index.json';

/** Reads an index from its JSON (text or parsed); `source` names it in errors. Entries come back ordered by key. */
export function parseSymbolIndex(
  json: unknown,
  source: string
): SymbolIndexEntry[] {
  let root: any = json;
  if (typeof json === 'string') {
    try {
      root = JSON.parse(json);
    } catch (e) {
      throw new SymbolIndexUnavailableError(
        source,
        'not JSON: ' + (e as Error).message
      );
    }
  }
  if (root === null || typeof root !== 'object')
    throw new SymbolIndexUnavailableError(source, 'not a JSON object');
  const schema = typeof root.schema === 'string' ? root.schema : '';
  if (schema !== SYMBOL_INDEX_SCHEMA)
    throw new SymbolIndexUnavailableError(
      source,
      `schema is '${schema}', not '${SYMBOL_INDEX_SCHEMA}'`
    );
  if (!Array.isArray(root.entries))
    throw new SymbolIndexUnavailableError(source, 'no entries array');

  const keys = new Set<string>();
  const entries: SymbolIndexEntry[] = root.entries.map((e: any, i: number) => {
    if (
      e === null ||
      typeof e !== 'object' ||
      typeof e.key !== 'string' ||
      e.key.length === 0 ||
      !Array.isArray(e.phrases)
    )
      throw new SymbolIndexUnavailableError(
        source,
        `entry ${i} has no key or no phrases`
      );
    if (keys.has(e.key))
      throw new SymbolIndexUnavailableError(
        source,
        `key '${e.key}' appears twice`
      );
    keys.add(e.key);
    const str = (v: unknown, d: string): string =>
      typeof v === 'string' ? v : d;
    return {
      key: e.key,
      deltaSidc: str(e.deltaSidc, ''),
      charlieSidc: str(e.charlieSidc, ''),
      symbolType: str(e.symbolType, ''),
      name: str(e.name, ''),
      phrases: e.phrases.filter(
        (p: unknown) => typeof p === 'string' && p.trim().length > 0
      ),
      gesture: str(e.gesture, 'point'),
      defaultAffiliation: str(e.defaultAffiliation, 'friend')
    };
  });
  return entries.sort((a, b) => ordinal(a.key, b.key));
}

/** The words a text loses before it is searched (STP's list). */
export const SYMBOL_SEARCH_STOP_WORDS: ReadonlySet<string> = new Set([
  'squad',
  'team',
  'section',
  'platoon',
  'comapny',
  'battery',
  'troop',
  'battalion',
  'squadron',
  'brigade',
  'enemy',
  'hostile',
  'friendly',
  'a',
  'the',
  'an',
  'of',
  'by',
  'are',
  'and',
  'be',
  'that',
  'in'
]);

const f32 = Math.fround;
const FUZZY_MIN_SIMILARITY = 0.5;
const STAND_ALONE_BOOST = 1.5;

interface Doc {
  entry: SymbolIndexEntry;
  tf: Map<string, number>;
  standAlone: Map<string, number>;
  norm: number;
}

/** A required clause: the terms it expands to with their boosts; a prefix or fuzzy clause is coordinated on its own. */
interface Clause {
  terms: [string, number][];
  expanded: boolean;
}

type Ranked = { doc: Doc; score: number };

export class SymbolSearch {
  /** The default cap on results. */
  static readonly DEFAULT_MAX_RESULTS = 20;

  private readonly docs: Doc[] = [];
  private readonly df = new Map<string, number>();
  private readonly terms: string[];
  private readonly exactPhrases = new Map<string, Set<string>>();

  /** Indexes `entries` (from {@link parseSymbolIndex}) for searching. */
  constructor(entries: SymbolIndexEntry[]) {
    for (const entry of entries) {
      const doc: Doc = { entry, tf: new Map(), standAlone: new Map(), norm: 0 };
      let tokens = 0;
      for (const line of documentLines(entry)) {
        const stems = tokenize(line).map(Porter2Stemmer.stem);
        for (const t of stems) {
          doc.tf.set(t, (doc.tf.get(t) ?? 0) + 1);
          tokens++;
        }
        for (let i = 0; i + 2 < stems.length; i++)
          if (stems[i] === 'start' && stems[i + 2] === 'end')
            doc.standAlone.set(
              stems[i + 1],
              (doc.standAlone.get(stems[i + 1]) ?? 0) + 1
            );
      }
      doc.norm = lengthNorm(tokens);
      this.docs.push(doc);
      for (const t of doc.tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.exactPhrases.set(entry.key, new Set(entry.phrases.map(normalize)));
    }
    this.terms = [...this.df.keys()].sort(ordinal);
  }

  /** A search over an index given as JSON (text or parsed); `source` names it in errors. */
  static fromIndex(json: unknown, source = 'the given index'): SymbolSearch {
    return new SymbolSearch(parseSymbolIndex(json, source));
  }

  /** The index URL of the most recently connected StpWebSocketsConnector, if any (set by the connector). */
  static connectedIndexUrl: string | undefined;

  /**
   * Fetches the index at `url` and indexes it. With no `url` (STP-1383): the index served by the bridge the most
   * recently connected {@link StpWebSocketsConnector} uses, else {@link DEFAULT_SYMBOL_INDEX_URL}. Any failure is a
   * {@link SymbolIndexUnavailableError} that names its reason - an older STP, a missing install, a bad file - never an
   * empty answer.
   */
  static async load(
    url?: string,
    fetchFn: (
      url: string
    ) => Promise<{ ok: boolean; status: number; text(): Promise<string> }> = (
      u
    ) => fetch(u)
  ): Promise<SymbolSearch> {
    const fromStp = url === undefined || url.trim().length === 0;
    const target = fromStp
      ? (SymbolSearch.connectedIndexUrl ?? DEFAULT_SYMBOL_INDEX_URL)
      : url!;
    // A URL on STP's route gets the "older STP" explanation; any other URL just its HTTP status.
    const stpRoute =
      fromStp || target.split(/[?#]/)[0].endsWith(SYMBOL_INDEX_PATH);
    let text: string;
    try {
      const response = await fetchFn(target);
      if (!response.ok)
        throw new SymbolIndexUnavailableError(
          target,
          await SymbolSearch.failureReason(response, stpRoute)
        );
      text = await response.text();
    } catch (e) {
      if (e instanceof SymbolIndexUnavailableError) throw e;
      const message = (e as Error).message || String(e);
      throw new SymbolIndexUnavailableError(
        target,
        stpRoute ? `${message}; ${OLDER_STP}` : message
      );
    }
    return SymbolSearch.fromIndex(text, target);
  }

  /** Why a non-2xx answer failed: STP's own "not installed" body when it sent one, else the status (explained on STP's route). */
  private static async failureReason(
    response: { status: number; text(): Promise<string> },
    stpRoute: boolean
  ): Promise<string> {
    let body: { error?: unknown; expected?: unknown } | undefined;
    try {
      body = JSON.parse(await response.text());
    } catch {
      body = undefined;
    }
    if (body && typeof body.error === 'string')
      return typeof body.expected === 'string'
        ? `HTTP ${response.status}: ${body.error} (expected at ${body.expected})`
        : `HTTP ${response.status}: ${body.error}`;
    return stpRoute
      ? `HTTP ${response.status}; ${OLDER_STP}`
      : `HTTP ${response.status}`;
  }

  /** The symbols matching `text`, best first, at most `maxResults`; empty for spaces or only stop words, or no match. */
  search(
    text: string,
    maxResults = SymbolSearch.DEFAULT_MAX_RESULTS
  ): SymbolSearchResult[] {
    if (!Number.isInteger(maxResults) || maxResults < 1)
      throw new RangeError('maxResults must be at least 1');
    const ws = words(text);
    if (ws.length === 0) return [];

    let ranked = this.cascade(ws);
    if (ranked.length === 0) ranked = this.mergeWordByWord(ws);

    // The exact phrase first (stable: the rest keep their order).
    const normalized = normalize(text);
    const exact = ranked.filter((r) =>
      this.exactPhrases.get(r.doc.entry.key)!.has(normalized)
    );
    if (exact.length > 0) {
      const top = ranked[0].score;
      ranked = exact
        .map((r) => ({ doc: r.doc, score: f32(r.score + top) }))
        .concat(ranked.filter((r) => !exact.includes(r)));
    }

    return ranked.slice(0, maxResults).map((r) => ({
      key: r.doc.entry.key,
      deltaSidc: r.doc.entry.deltaSidc,
      charlieSidc: r.doc.entry.charlieSidc,
      name: r.doc.entry.name,
      speech: speechFor(r.doc.entry, normalized, ws),
      gesture: r.doc.entry.gesture,
      defaultAffiliation: r.doc.entry.defaultAffiliation,
      score: r.score
    }));
  }

  private idf(term: string): number {
    return f32(
      Math.log(this.docs.length / ((this.df.get(term) ?? 0) + 1)) + 1.0
    );
  }

  private exact(term: string): Clause {
    return { terms: this.df.has(term) ? [[term, 1]] : [], expanded: false };
  }

  private prefix(prefix: string): Clause {
    return {
      terms: this.terms
        .filter((t) => t.startsWith(prefix))
        .map((t): [string, number] => [t, 1]),
      expanded: true
    };
  }

  private fuzzy(word: string): Clause {
    const terms: [string, number][] = [];
    for (const t of this.terms) {
      const shorter = Math.min(word.length, t.length);
      if (Math.abs(word.length - t.length) >= shorter) continue;
      const similarity = 1 - editDistance(word, t) / shorter;
      if (similarity > FUZZY_MIN_SIMILARITY)
        terms.push([
          t,
          f32((similarity - FUZZY_MIN_SIMILARITY) / (1 - FUZZY_MIN_SIMILARITY))
        ]);
    }
    return { terms, expanded: true };
  }

  /** The passes: exact, prefix, stem, stem prefix, edits, stem edits - the first that finds anything answers. */
  private cascade(ws: string[]): Ranked[] {
    const stems = ws.map(Porter2Stemmer.stem);
    const passes: (() => Clause[])[] = [
      () => distinct(ws).map((w) => this.exact(w)),
      () => ws.map((w) => this.prefix(w)),
      () => distinct(stems).map((s) => this.exact(s)),
      () => stems.map((s) => this.prefix(s)),
      () => ws.map((w) => this.fuzzy(w)),
      () => stems.map((s) => this.fuzzy(s))
    ];
    for (const pass of passes) {
      const found = this.score(pass(), stems);
      if (found.length > 0) return found;
    }
    return [];
  }

  /** Every clause required, plus the optional stand-alone boosts; best first, equal scores by key. */
  private score(clauses: Clause[], stems: string[]): Ranked[] {
    let sumOfSquares = 0;
    for (const clause of clauses)
      for (const [term, boost] of clause.terms)
        sumOfSquares += Math.pow(f32(this.idf(term) * boost), 2);
    const standAloneIdf = stems.map((t) =>
      f32(f32(this.idf('start') + this.idf(t)) + this.idf('end'))
    );
    for (const idf of standAloneIdf)
      sumOfSquares += Math.pow(f32(idf * STAND_ALONE_BOOST), 2);
    const queryNorm = sumOfSquares > 0 ? f32(1 / Math.sqrt(sumOfSquares)) : 0;
    const maxOverlap = clauses.length + stems.length;

    const found: Ranked[] = [];
    for (const doc of this.docs) {
      const s = this.scoreOne(
        doc,
        clauses,
        stems,
        standAloneIdf,
        queryNorm,
        maxOverlap
      );
      if (s !== null) found.push({ doc, score: s });
    }
    if (found.length === 0) return found;

    // Stable: the documents are in key order, so equal scores stay by key.
    const ordered = found
      .map((x, i) => ({ x, i }))
      .sort((a, b) => b.x.score - a.x.score || a.i - b.i)
      .map((p) => p.x);
    const top = ordered[0].score;
    return top > 1
      ? ordered.map((x) => ({ doc: x.doc, score: f32(x.score / top) }))
      : ordered;
  }

  private scoreOne(
    doc: Doc,
    clauses: Clause[],
    stems: string[],
    standAloneIdf: number[],
    queryNorm: number,
    maxOverlap: number
  ): number | null {
    let total = 0;
    let overlap = 0;
    for (const clause of clauses) {
      let clauseScore = 0;
      let matched = 0;
      for (const [term, boost] of clause.terms) {
        const tf = doc.tf.get(term);
        if (tf === undefined) continue;
        const idf = this.idf(term);
        clauseScore = f32(
          clauseScore +
            f32(
              f32(
                f32(f32(f32(f32(Math.sqrt(tf)) * idf) * idf) * boost) *
                  queryNorm
              ) * doc.norm
            )
        );
        matched++;
      }
      if (matched === 0) return null;
      if (clause.expanded)
        clauseScore = f32(clauseScore * f32(matched / clause.terms.length));
      total = f32(total + clauseScore);
      overlap++;
    }
    for (let i = 0; i < stems.length; i++) {
      const f = doc.standAlone.get(stems[i]) ?? 0;
      if (f === 0) continue;
      const sa = standAloneIdf[i];
      total = f32(
        total +
          f32(
            f32(
              f32(f32(f32(f32(Math.sqrt(f)) * sa) * sa) * STAND_ALONE_BOOST) *
                queryNorm
            ) * doc.norm
          )
      );
      overlap++;
    }
    return f32(f32(total * overlap) / maxOverlap);
  }

  /** Each word searched alone, the hits merged by symbol and ordered by their summed score over the word count. */
  private mergeWordByWord(ws: string[]): Ranked[] {
    const merged: Ranked[] = [];
    const at = new Map<Doc, number>();
    for (const w of ws) {
      for (const { doc, score } of this.cascade([w])) {
        const i = at.get(doc);
        if (i !== undefined)
          merged[i] = { doc, score: f32(merged[i].score + score) };
        else {
          at.set(doc, merged.length);
          merged.push({ doc, score });
        }
      }
    }
    const n = ws.length;
    return merged
      .map((m, i) => ({ m: { doc: m.doc, score: f32(m.score / n) }, i }))
      .sort((a, b) => b.m.score - a.m.score || a.i - b.i)
      .map((p) => p.m);
  }
}

// ---- the documents ---------------------------------------------------------------------------------------

/**
 * The text STP indexes for a symbol: per phrase, the word pairs and triples of "Start w1 Mid w2 ... End" (each
 * line once), then a Start_<code>_End line for its key and its codes with the affiliation swept over friend,
 * hostile, unknown and neutral.
 */
export function documentLines(entry: SymbolIndexEntry): string[] {
  const lines: string[] = [];
  const add = (line: string): void => {
    if (!lines.includes(line)) lines.push(line);
  };
  for (const phrase of entry.phrases) {
    const ws = ('Start ' + phrase.trim().split(' ').join(' Mid ') + ' End')
      .split(' ')
      .filter((w) => w.length > 0);
    for (const n of [2, 3])
      for (let i = 0; i + n <= ws.length; i++)
        add(ws.slice(i, i + n).join(' '));
  }
  add('Start_' + entry.key + '_End');
  for (const code of sweptCodes(entry)) add('Start_' + code + '_End');
  return lines;
}

function* sweptCodes(entry: SymbolIndexEntry): Generator<string> {
  // 2525D: the standard identity (positions 3-4) as friend 03, hostile 06, unknown 01, neutral 04; the pending
  // '-' leaves the code as it is.
  const d = entry.deltaSidc;
  if (d.length === 20) {
    for (const si of ['03', '06', '01', '04'])
      yield d.substring(0, 2) + si + d.substring(4);
    yield d;
  }
  // 2525C: the affiliation character (position 2).
  const c = entry.charlieSidc;
  if (c.length >= 2)
    for (const a of 'FHUN-') yield c.substring(0, 1) + a + c.substring(2);
}

const JOINERS = '_-/.,';
// As .NET's char.IsLetterOrDigit / char.IsDigit: letters and decimal digits only.
const isLetterOrDigit = (c: string): boolean => /[\p{L}\p{Nd}]/u.test(c);
const isDigit = (c: string): boolean => /\p{Nd}/u.test(c);

/**
 * Words as STP's tokenizer reads them, lower case: a run carrying a digit joined by _ - / . , is one word (a code
 * line); anything else splits at every character that is not a letter or digit.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const chunk of text.split(/[ \t]/).filter((c) => c.length > 0)) {
    const chars = [...chunk];
    if (
      chars.some(isDigit) &&
      chars.some((c) => JOINERS.includes(c)) &&
      chars.every((c) => isLetterOrDigit(c) || JOINERS.includes(c))
    ) {
      out.push(trimChars(chunk, JOINERS).toLowerCase());
      continue;
    }
    let word = '';
    for (const ch of chars) {
      if (isLetterOrDigit(ch)) word += ch.toLowerCase();
      else if (word.length > 0) {
        out.push(word);
        word = '';
      }
    }
    if (word.length > 0) out.push(word);
  }
  return out;
}

function trimChars(s: string, chars: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && chars.includes(s[start])) start++;
  while (end > start && chars.includes(s[end - 1])) end--;
  return s.substring(start, end);
}

/** 1/sqrt(tokens), through the one-byte encoding the classic index stores it in. */
export function lengthNorm(tokens: number): number {
  if (tokens <= 0) return 0;
  const buffer = new DataView(new ArrayBuffer(4));
  buffer.setFloat32(0, 1 / Math.sqrt(tokens));
  const bits = buffer.getInt32(0);
  let mantissa = (bits & 0xffffff) >> 21;
  let exponent = ((bits >> 24) & 0x7f) - 63 + 15;
  if (exponent > 31) {
    exponent = 31;
    mantissa = 7;
  }
  if (exponent < 0) {
    exponent = 0;
    mantissa = 1;
  }
  const encoded = (exponent << 3) | mantissa;
  if (encoded === 0) return 0;
  buffer.setInt32(
    0,
    ((((encoded >> 3) & 31) + (63 - 15)) << 24) | ((encoded & 7) << 21)
  );
  return buffer.getFloat32(0);
}

// ---- words -----------------------------------------------------------------------------------------------

/** A text or phrase compared for an exact match: lower case, spacing ignored (stop words count). */
function normalize(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .split(/[ \t\r\n]/)
    .filter((w) => w.length > 0)
    .join(' ');
}

function words(text: string): string[] {
  return (text ?? '')
    .toLowerCase()
    .split(/[ \t\r\n]/)
    .filter((w) => w.length > 0 && !SYMBOL_SEARCH_STOP_WORDS.has(w));
}

const distinct = (xs: string[]): string[] => [...new Set(xs)];

/** Ordinal (code unit) order, as the .NET SDK sorts. */
function ordinal(a: string, b: string): number {
  return a < b ? -1 : Number(a > b);
}

function editDistance(a: string, b: string): number {
  const row: number[] = [];
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return row[b.length];
}

/** The phrase that matched: the exact phrase, else the one sharing the most of the text's stems, else the first. */
function speechFor(
  entry: SymbolIndexEntry,
  normalized: string,
  ws: string[]
): string {
  const stems = new Set(ws.map(Porter2Stemmer.stem));
  let best = entry.phrases.length > 0 ? entry.phrases[0] : '';
  let bestShared = -1;
  for (const phrase of entry.phrases) {
    if (normalize(phrase) === normalized) return phrase;
    const shared = words(phrase)
      .map(Porter2Stemmer.stem)
      .filter((s) => stems.has(s)).length;
    if (shared > bestShared) {
      best = phrase;
      bestShared = shared;
    }
  }
  return best;
}
