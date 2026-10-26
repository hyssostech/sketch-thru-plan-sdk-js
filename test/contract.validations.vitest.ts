import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const byName = (a: string, b: string) => a.localeCompare(b);

/**
 * STP-1064. json-api/sketch-thru-plan-validations.json is the shared, data-driven rule set a
 * client evaluates around a state-changing call: preconditions, required params and poid
 * references before it, and the events that prove it was done (intent) after it. Every method,
 * param path, event and event path it names must exist in the contract, so a contract change
 * that breaks a rule fails here rather than in an evaluator at run time.
 */

const dir = path.join(process.cwd(), 'json-api');
const CONTRACT = JSON.parse(fs.readFileSync(path.join(dir, 'sketch-thru-plan-api.json'), 'utf8'));
const RULES_TEXT = fs.readFileSync(path.join(dir, 'sketch-thru-plan-validations.json'), 'utf8');
const RULES = JSON.parse(RULES_TEXT);
const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(dir, 'sketch-thru-plan-validations.schema.json'), 'utf8'),
);

type Json = Record<string, any>;
const METHODS: Json[] = CONTRACT.methods;
const SCHEMAS: Json = CONTRACT.components.schemas;
const EVENTS = new Map<string, Json>(CONTRACT['x-stpEvents'].map((e: Json) => [e.name, e]));
const KINDS: string[] = SCHEMA.definitions.kind.enum;
const ruleOf = (name: string): Json => RULES.methods[name];
const methodOf = (name: string): Json => METHODS.find((m) => m.name === name)!;
const ruleEntries = (): [string, Json][] => Object.entries(RULES.methods as Json);

/** Dispatched, non-transport, non-client methods that change state: the ones the rule file must cover. */
const STATE_CHANGING = METHODS.filter(
  (m) =>
    m['x-stpSafety'] !== 'read' &&
    m['x-layer'] !== 'transport' &&
    m['x-layer'] !== 'client' &&
    m['x-engineDispatch'] !== 'none',
).map((m) => m.name);

/** Whether `segments` lead somewhere inside `schema` (component refs, allOf and array items followed). */
function hasPath(schema: Json | undefined, segments: string[]): boolean {
  if (!schema) return false;
  if (typeof schema.$ref === 'string') {
    return hasPath(SCHEMAS[schema.$ref.replace('#/components/schemas/', '')], segments);
  }
  if (segments.length === 0) return true;
  if (Array.isArray(schema.allOf) && schema.allOf.some((s: Json) => hasPath(s, segments))) return true;
  if (Array.isArray(schema.oneOf) && schema.oneOf.some((s: Json) => hasPath(s, segments))) return true;
  const [head, ...rest] = segments;
  if (head === '*' || /^\d+$/.test(head)) return hasPath(schema.items, rest);
  if (schema.properties && head in schema.properties) return hasPath(schema.properties[head], rest);
  // An open object (free-form, e.g. object-set items) cannot be checked deeper.
  if (schema.additionalProperties === true) return true;
  if (schema.type === 'object' && !schema.properties && !schema.allOf) return true;
  return false;
}

const paramHasPath = (method: Json, dotted: string): boolean => {
  const [head, ...rest] = dotted.split('.');
  const param = (method.params ?? []).find((p: Json) => p.name === head);
  if (!param) return false;
  if (rest.length === 1 && rest[0] === 'length') return isArray(param.schema);
  return hasPath(param.schema, rest);
};

const eventHasPath = (event: string, dotted: string): boolean => {
  const [head, ...rest] = dotted.split('.');
  const param = (EVENTS.get(event)?.params ?? []).find((p: Json) => p.name === head);
  return param !== undefined && hasPath(param.schema, rest);
};

function isArray(schema: Json): boolean {
  const s = schema.$ref ? SCHEMAS[schema.$ref.replace('#/components/schemas/', '')] : schema;
  return s?.type === 'array';
}

/** Every { event, match } of an intent, with where it came from. */
function eventMatches(name: string, intent: Json): { where: string; event: string; match?: Json; forEach?: string }[] {
  const out: { where: string; event: string; match?: Json; forEach?: string }[] = [];
  for (const [i, e] of (intent.expect ?? []).entries()) {
    for (const alt of e.anyOf ?? [e]) {
      out.push({ where: `${name}.expect[${i}]`, event: alt.event, match: alt.match, forEach: e.forEach });
    }
  }
  for (const [i, e] of (intent.other ?? []).entries()) {
    out.push({ where: `${name}.other[${i}]`, event: e.event, match: e.match });
  }
  return out;
}

describe('validation rules file (STP-1064)', () => {
  it('is ASCII JSON indented by 2 spaces', () => {
    expect(/^[\x00-\x7F]*$/.test(RULES_TEXT)).toBe(true);
    expect(RULES_TEXT).toBe(JSON.stringify(RULES, null, 2) + '\n');
  });

  it('names its schema and the contract version it was checked against', () => {
    expect(RULES.$schema).toBe('./sketch-thru-plan-validations.schema.json');
    expect(RULES.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(RULES.contractVersion).toBe(CONTRACT.info.version);
  });

  it('uses only the keys its schema defines', () => {
    const allowed = (def: string) => Object.keys(SCHEMA.definitions[def].properties);
    expect(Object.keys(RULES).filter((k) => !Object.keys(SCHEMA.properties).includes(k))).toEqual([]);
    const bad: string[] = [];
    for (const [name, rule] of ruleEntries()) {
      for (const k of Object.keys(rule)) if (!allowed('method').includes(k)) bad.push(`${name}.${k}`);
      for (const k of Object.keys(rule.intent)) if (!allowed('intent').includes(k)) bad.push(`${name}.intent.${k}`);
      for (const ref of rule.references ?? []) {
        for (const k of Object.keys(ref)) if (!allowed('reference').includes(k)) bad.push(`${name}.references.${k}`);
      }
      for (const e of rule.intent.expect) {
        for (const k of Object.keys(e)) if (!allowed('expectation').includes(k)) bad.push(`${name}.expect.${k}`);
        if (('event' in e) === ('anyOf' in e)) bad.push(`${name}.expect: needs exactly one of event, anyOf`);
        if ('where' in e && !('forEach' in e)) bad.push(`${name}.expect: where without forEach`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('covers exactly the write and destructive methods the engine dispatches', () => {
    expect(STATE_CHANGING.length).toBeGreaterThanOrEqual(50);
    expect(Object.keys(RULES.methods).sort(byName)).toEqual([...STATE_CHANGING].sort(byName));
  });

  it('requires an active scenario for every call except the ones that create one', () => {
    const creators = ['CreateNewScenario', 'LoadNewScenario', 'LoadNewScenarioFromObjectSet'];
    for (const [name, rule] of ruleEntries()) {
      expect(rule.preconditions, name).toEqual(creators.includes(name) ? [] : ['activeScenario']);
    }
  });

  it('names only params the method has (required, references, value refs, forEach)', () => {
    const bad: string[] = [];
    for (const [name, rule] of ruleEntries()) {
      const method = methodOf(name);
      for (const p of rule.required ?? []) if (!paramHasPath(method, p)) bad.push(`${name}.required: ${p}`);
      for (const r of rule.references ?? []) if (!paramHasPath(method, r.param)) bad.push(`${name}.references: ${r.param}`);
      for (const e of rule.intent.expect) {
        if (e.forEach && !(paramHasPath(method, e.forEach) && isArray(method.params.find((p: Json) => p.name === e.forEach).schema))) {
          bad.push(`${name}.forEach: ${e.forEach} is not an array param`);
        }
      }
      for (const m of eventMatches(name, rule.intent)) {
        for (const ref of Object.values(m.match ?? {}) as Json[]) {
          if (ref.param !== undefined && !paramHasPath(method, ref.param)) bad.push(`${m.where}: param ${ref.param}`);
          if (ref.item !== undefined && !m.forEach) bad.push(`${m.where}: item ref ${ref.item} outside forEach`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('uses only known reference kinds, and every required reference is a top-level param', () => {
    for (const [name, rule] of ruleEntries()) {
      for (const r of rule.references ?? []) {
        const kinds = Array.isArray(r.kind) ? r.kind : [r.kind];
        for (const k of kinds) expect(KINDS, `${name}: ${r.param}`).toContain(k);
        if (r.required) expect(r.param, name).toMatch(/^[A-Za-z]+$/);
      }
    }
  });

  it('names only contract events, at paths their schemas have', () => {
    const bad: string[] = [];
    if (!EVENTS.has(RULES.refusalMessage.event)) bad.push(`refusalMessage: ${RULES.refusalMessage.event}`);
    for (const [name, rule] of ruleEntries()) {
      for (const a of rule.intent.acks ?? []) if (!EVENTS.has(a)) bad.push(`${name}.acks: ${a}`);
      for (const m of eventMatches(name, rule.intent)) {
        if (!EVENTS.has(m.event)) bad.push(`${m.where}: ${m.event}`);
        for (const p of Object.keys(m.match ?? {})) if (!eventHasPath(m.event, p)) bad.push(`${m.where}: ${m.event}.${p}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('expects only events the method emits, and every event it always emits', () => {
    const bad: string[] = [];
    for (const [name, rule] of ruleEntries()) {
      const emits: Json[] = methodOf(name)['x-stpEmits'] ?? [];
      const emitted = new Set(emits.map((e) => e.event));
      const expected = new Set(eventMatches(name, { expect: rule.intent.expect }).map((m) => m.event));
      for (const e of expected) if (!emitted.has(e)) bad.push(`${name}: expects ${e}, which x-stpEmits does not list`);
      for (const a of rule.intent.acks ?? []) if (!emitted.has(a)) bad.push(`${name}: ack ${a} is not in x-stpEmits`);
      const always = emits.filter((e) => e.when === 'always' && e.event !== 'StpMessage').map((e) => e.event);
      for (const e of always) {
        if (!expected.has(e) && !(rule.intent.acks ?? []).includes(e)) bad.push(`${name}: always emits ${e}, not expected`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('marks as unverifiable only events held back by an issue the method still lists', () => {
    const marked = ruleEntries().filter(([, r]) => r.intent.unverifiable);
    // STP-1089 (task org relationship events) and STP-1080 (UpdateTask's TaskModified) are fixed
    // in the engine (contract 0.9.2): their events are expected again, so nothing holds them back.
    const fixedIssues = new Set(['STP-1080', 'STP-1089']);
    expect(marked.filter(([, r]) => fixedIssues.has(r.intent.unverifiable.issue))).toEqual([]);
    for (const [name, rule] of marked) {
      expect(methodOf(name)['x-stpKnownIssues'] ?? [], name).toContain(rule.intent.unverifiable.issue);
      expect(rule.intent.expect.length, name).toBeGreaterThan(0);
    }
  });

  it('gives every destructive method, and only those, a confirmation text naming real params', () => {
    for (const [name, rule] of ruleEntries()) {
      const method = methodOf(name);
      expect('confirm' in rule, name).toBe(method['x-stpSafety'] === 'destructive');
      for (const [, p] of (rule.confirm ?? '').matchAll(/\{([^}]+)\}/g)) {
        expect(paramHasPath(method, p), `${name}: {${p}}`).toBe(true);
      }
    }
  });

  it('counts per item on the object-set imports, the multi-object calls', () => {
    const perItem = ruleEntries()
      .filter(([, r]) => r.intent.expect.some((e: Json) => e.forEach))
      .map(([n]) => n);
    expect(perItem.sort(byName)).toEqual(
      [
        'ImportCoaFromObjectSet',
        'ImportPlanDataFromObjectSet',
        'ImportTaskOrgFromObjectSet',
        'LoadNewScenarioFromObjectSet',
        'SyncScenarioSessionFromObjectSet',
      ].sort(byName),
    );
  });
});

describe('validation rules schema (STP-1064)', () => {
  it('is a draft-07 schema, ASCII, whose kinds and preconditions are the ones the rules use', () => {
    const text = fs.readFileSync(path.join(dir, 'sketch-thru-plan-validations.schema.json'), 'utf8');
    expect(/^[\x00-\x7F]*$/.test(text)).toBe(true);
    expect(SCHEMA.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(SCHEMA.definitions.method.properties.preconditions.items.enum).toEqual(['activeScenario']);
    const used = new Set<string>();
    for (const [, r] of ruleEntries()) for (const ref of r.references ?? []) for (const k of [ref.kind].flat()) used.add(k);
    for (const k of used) expect(KINDS).toContain(k);
  });
});
