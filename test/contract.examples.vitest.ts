import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * STP-1059. Every contract method carries an example captured from a live engine, and the
 * edge cases the capture tried (x-stpEdgeCases), so a model or a client sees real wire
 * shapes and knows what a bad call gets back - including the calls that get nothing back.
 */

const CONTRACT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'json-api', 'sketch-thru-plan-api.json'), 'utf8'),
);
const METHODS: Array<Record<string, any>> = CONTRACT.methods;
const EVENTS = new Set<string>(CONTRACT['x-stpEvents'].map((e: { name: string }) => e.name));
const OUTCOMES = ['refused', 'announced', 'ignored', 'accepted'];

const examplesOf = (m: Record<string, any>): Array<Record<string, any>> => m.examples ?? [];

describe('OpenRPC contract examples and edge cases (STP-1059)', () => {
  it('gives every method at least one example', () => {
    const bad = METHODS.filter((m) => examplesOf(m).length === 0).map((m) => m.name);
    expect(bad).toEqual([]);
  });

  it('names and describes every example', () => {
    const bad = METHODS.flatMap((m) =>
      examplesOf(m)
        .filter((e) => typeof e.name !== 'string' || typeof e.description !== 'string' || !Array.isArray(e.params))
        .map(() => m.name),
    );
    expect(bad).toEqual([]);
  });

  it('uses only the parameters the method declares, in their declared order', () => {
    const bad = METHODS.flatMap((m) => {
      const declared: string[] = (m.params ?? []).map((p: { name: string }) => p.name);
      return examplesOf(m).flatMap((e) => {
        const used: string[] = e.params.map((p: { name: string }) => p.name);
        const known = used.every((n) => declared.includes(n));
        const ordered = used.every((n, i) => i === 0 || declared.indexOf(used[i - 1]) < declared.indexOf(n));
        return known && ordered ? [] : [`${m.name}: ${used.join(', ')}`];
      });
    });
    expect(bad).toEqual([]);
  });

  it('gives a result to the examples of methods that answer, and none to informs', () => {
    const bad = METHODS.flatMap((m) =>
      examplesOf(m)
        .filter((e) => !/not completed/.test(e.name))
        .filter((e) => ('result' in e) === (m['x-stpInform'] === true))
        .map(() => m.name),
    );
    expect(bad).toEqual([]);
  });

  it('names the result as the method does', () => {
    const bad = METHODS.flatMap((m) =>
      examplesOf(m)
        .filter((e) => 'result' in e && e.result.name !== m.result?.name)
        .map((e) => `${m.name}: ${e.result.name}`),
    );
    expect(bad).toEqual([]);
  });

  it('observes only events the contract lists (plus the RequestResponse transport event)', () => {
    const bad = METHODS.flatMap((m) =>
      examplesOf(m).flatMap((e) =>
        (e['x-stpEventsObserved'] ?? [])
          .map((o: { event: string }) => o.event)
          .filter((n: string) => !EVENTS.has(n) && n !== 'RequestResponse')
          .map((n: string) => `${m.name}: ${n}`),
      ),
    );
    expect(bad).toEqual([]);
  });

  it('carries no PrologTerm in examples (STP-1085)', () => {
    const values = (e: Record<string, any>) => JSON.stringify([e.params, e.result, e['x-stpEventsObserved']]);
    const bad = METHODS.filter((m) => examplesOf(m).some((e) => values(e).includes('PrologTerm'))).map((m) => m.name);
    expect(bad).toEqual([]);
  });

  it('gives every edge case a when and a known outcome, and a message to refusals', () => {
    const bad = METHODS.flatMap((m) =>
      (m['x-stpEdgeCases'] ?? [])
        .filter(
          (c: Record<string, any>) =>
            typeof c.when !== 'string' ||
            !OUTCOMES.includes(c.outcome) ||
            (['refused', 'announced'].includes(c.outcome) && typeof c.message !== 'string'),
        )
        .map((c: Record<string, any>) => `${m.name}: ${c.when}`),
    );
    expect(bad).toEqual([]);
  });

  it('documents what the capture saw, including the calls that got nothing back', () => {
    const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0]));
    for (const m of METHODS) for (const c of m['x-stpEdgeCases'] ?? []) counts[c.outcome]++;
    expect(counts.ignored).toBeGreaterThan(0);
    expect(counts.refused).toBeGreaterThan(0);
  });

  it('describes CreateNewScenario as returning the new poid (STP-1087)', () => {
    const m = METHODS.find((x) => x.name === 'CreateNewScenario')!;
    expect(m.result.schema.type).toBe('string');
    expect(typeof examplesOf(m)[0].result.value).toBe('string');
  });
});
