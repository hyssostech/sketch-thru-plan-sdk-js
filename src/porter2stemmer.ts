/**
 * The Snowball English ("Porter2") stemmer, which STP's own symbol search applies to the index and to the
 * query (STP-1373). {@link SymbolSearch} matches stems with it, so "harbored" finds "harbor" and "lanterns"
 * finds "lantern". An implementation of the published algorithm (snowballstem.org); input is one lower-case
 * word.
 */
export class Porter2Stemmer {
  private static readonly exceptions: Record<string, string> = {
    skis: 'ski',
    skies: 'sky',
    dying: 'die',
    lying: 'lie',
    tying: 'tie',
    idly: 'idl',
    gently: 'gentl',
    ugly: 'ugli',
    early: 'earli',
    only: 'onli',
    singly: 'singl',
    sky: 'sky',
    news: 'news',
    howe: 'howe',
    atlas: 'atlas',
    cosmos: 'cosmos',
    bias: 'bias',
    andes: 'andes'
  };

  private static readonly invariant1a = new Set([
    'inning',
    'outing',
    'canning',
    'herring',
    'earring',
    'proceed',
    'exceed',
    'succeed'
  ]);

  // Longest suffix first within each step: the step acts on the longest suffix that matches.
  private static readonly step2: [string, string][] = [
    ['ization', 'ize'],
    ['ational', 'ate'],
    ['fulness', 'ful'],
    ['ousness', 'ous'],
    ['iveness', 'ive'],
    ['tional', 'tion'],
    ['biliti', 'ble'],
    ['lessli', 'less'],
    ['entli', 'ent'],
    ['ation', 'ate'],
    ['alism', 'al'],
    ['aliti', 'al'],
    ['ousli', 'ous'],
    ['iviti', 'ive'],
    ['fulli', 'ful'],
    ['enci', 'ence'],
    ['anci', 'ance'],
    ['abli', 'able'],
    ['izer', 'ize'],
    ['ator', 'ate'],
    ['alli', 'al'],
    ['bli', 'ble'],
    ['ogi', 'og'],
    ['li', '']
  ];

  private static readonly step3: [string, string][] = [
    ['ational', 'ate'],
    ['tional', 'tion'],
    ['alize', 'al'],
    ['icate', 'ic'],
    ['iciti', 'ic'],
    ['ative', ''],
    ['ical', 'ic'],
    ['ness', ''],
    ['ful', '']
  ];

  private static readonly step4 = [
    'ement',
    'ance',
    'ence',
    'able',
    'ible',
    'ment',
    'ant',
    'ent',
    'ism',
    'ate',
    'iti',
    'ous',
    'ive',
    'ize',
    'ion',
    'al',
    'er',
    'ic'
  ];

  /** The stem of `word` (lower case). */
  static stem(word: string): string {
    if (word.length <= 2) return word;
    const exception = Porter2Stemmer.exceptions[word];
    if (Object.prototype.hasOwnProperty.call(Porter2Stemmer.exceptions, word))
      return exception;

    let w = word[0] === "'" ? word.substring(1) : word;
    w = markConsonantY(w);
    const r1 =
      w.startsWith('gener') || w.startsWith('arsen')
        ? 5
        : w.startsWith('commun')
          ? 6
          : regionAfter(w, 0);
    const r2 = regionAfter(w, r1);

    w = step0(w);
    w = step1a(w);
    if (Porter2Stemmer.invariant1a.has(w)) return w.replace(/Y/g, 'y');
    w = step1b(w, r1);
    w = step1c(w);
    w = replace(w, Porter2Stemmer.step2, r1, step2Condition);
    w = replace(
      w,
      Porter2Stemmer.step3,
      r1,
      (word, suffix) => suffix !== 'ative' || word.length - suffix.length >= r2
    );
    w = step4(w, r2, Porter2Stemmer.step4);
    w = step5(w, r1, r2);
    return w.replace(/Y/g, 'y');
  }
}

const isVowel = (c: string): boolean =>
  c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u' || c === 'y';
const hasVowel = (s: string): boolean => [...s].some(isVowel);
const cut = (w: string, n: number): string => w.substring(0, w.length - n);

function endsWithDouble(w: string): boolean {
  return (
    w.length >= 2 &&
    w[w.length - 1] === w[w.length - 2] &&
    'bdfgmnprt'.includes(w[w.length - 1])
  );
}

function markConsonantY(w: string): string {
  const c = [...w];
  for (let i = 0; i < c.length; i++)
    if (c[i] === 'y' && (i === 0 || isVowel(c[i - 1]))) c[i] = 'Y';
  return c.join('');
}

/** The region after the first non-vowel that follows a vowel, from `start`. */
function regionAfter(w: string, start: number): number {
  for (let i = start + 1; i < w.length; i++)
    if (!isVowel(w[i]) && isVowel(w[i - 1])) return i + 1;
  return w.length;
}

function endsInShortSyllable(w: string): boolean {
  const n = w.length;
  if (n === 2) return isVowel(w[0]) && !isVowel(w[1]);
  return (
    n >= 3 &&
    !isVowel(w[n - 3]) &&
    isVowel(w[n - 2]) &&
    !isVowel(w[n - 1]) &&
    w[n - 1] !== 'w' &&
    w[n - 1] !== 'x' &&
    w[n - 1] !== 'Y'
  );
}

function step0(w: string): string {
  for (const s of ["'s'", "'s", "'"])
    if (w.endsWith(s)) return cut(w, s.length);
  return w;
}

function step1a(w: string): string {
  if (w.endsWith('sses')) return cut(w, 2);
  if (w.endsWith('ied') || w.endsWith('ies'))
    return w.length > 4 ? cut(w, 2) : cut(w, 1);
  if (w.endsWith('us') || w.endsWith('ss')) return w;
  if (w.endsWith('s') && hasVowel(cut(w, 2))) return cut(w, 1);
  return w;
}

function step1b(w: string, r1: number): string {
  for (const s of ['eedly', 'eed'])
    if (w.endsWith(s))
      return w.length - s.length >= r1 ? cut(w, s.length) + 'ee' : w;
  for (const s of ['ingly', 'edly', 'ing', 'ed']) {
    if (!w.endsWith(s)) continue;
    const stem = cut(w, s.length);
    if (!hasVowel(stem)) return w;
    if (stem.endsWith('at') || stem.endsWith('bl') || stem.endsWith('iz'))
      return stem + 'e';
    if (endsWithDouble(stem)) return cut(stem, 1);
    if (r1 >= stem.length && endsInShortSyllable(stem)) return stem + 'e';
    return stem;
  }
  return w;
}

function step1c(w: string): string {
  const last = w[w.length - 1];
  if (
    w.length > 2 &&
    (last === 'y' || last === 'Y') &&
    !isVowel(w[w.length - 2])
  )
    return cut(w, 1) + 'i';
  return w;
}

function step2Condition(w: string, suffix: string): boolean {
  if (suffix === 'ogi') return w.length > 3 && w[w.length - 4] === 'l';
  if (suffix === 'li')
    return w.length > 2 && 'cdeghkmnrt'.includes(w[w.length - 3]);
  return true;
}

/** Replaces the longest listed suffix when it lies in `region` and the condition holds. */
function replace(
  w: string,
  table: [string, string][],
  region: number,
  condition: (w: string, suffix: string) => boolean
): string {
  for (const [suffix, by] of table) {
    if (!w.endsWith(suffix)) continue;
    return w.length - suffix.length >= region && condition(w, suffix)
      ? cut(w, suffix.length) + by
      : w;
  }
  return w;
}

function step4(w: string, r2: number, suffixes: string[]): string {
  for (const s of suffixes) {
    if (!w.endsWith(s)) continue;
    if (w.length - s.length < r2) return w;
    if (s === 'ion')
      return w.length > 3 &&
        (w[w.length - 4] === 's' || w[w.length - 4] === 't')
        ? cut(w, 3)
        : w;
    return cut(w, s.length);
  }
  return w;
}

function step5(w: string, r1: number, r2: number): string {
  if (w.endsWith('e')) {
    const at = w.length - 1;
    return at >= r2 || (at >= r1 && !endsInShortSyllable(cut(w, 1)))
      ? cut(w, 1)
      : w;
  }
  if (
    w.endsWith('l') &&
    w.length - 1 >= r2 &&
    w.length > 1 &&
    w[w.length - 2] === 'l'
  )
    return cut(w, 1);
  return w;
}
