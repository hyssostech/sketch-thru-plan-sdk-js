import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * STP-1059. Every contract method lists the events that follow a call (x-stpEmits), so a
 * client - or a tool generator such as the stp-mcp server - knows what to wait for. Methods
 * the engine does not yet serve as described name the filed issues (x-stpKnownIssues).
 */

const CONTRACT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'json-api', 'sketch-thru-plan-api.json'), 'utf8'),
);
const METHODS: Array<Record<string, any>> = CONTRACT.methods;
const EVENTS = new Set<string>(CONTRACT['x-stpEvents'].map((e: { name: string }) => e.name));

type Emit = { event: string; when: string; condition?: string; to: string };
const emitsOf = (m: Record<string, any>): Emit[] => m['x-stpEmits'] ?? [];
const byName = (a: string, b: string) => a.localeCompare(b);

describe('contract emitted events (STP-1059)', () => {
  it('gives every method an x-stpEmits array', () => {
    const bad = METHODS.filter((m) => !Array.isArray(m['x-stpEmits'])).map((m) => m.name);
    expect(bad).toEqual([]);
  });

  it('names only events listed in x-stpEvents', () => {
    const bad = METHODS.flatMap((m) =>
      emitsOf(m).filter((e) => !EVENTS.has(e.event)).map((e) => `${m.name}: ${e.event}`),
    );
    expect(bad).toEqual([]);
  });

  it('uses only the known when and to values, and only the four keys', () => {
    const bad = METHODS.flatMap((m) =>
      emitsOf(m)
        .filter(
          (e) =>
            !['always', 'if', 'may'].includes(e.when) ||
            !['caller', 'session'].includes(e.to) ||
            Object.keys(e).some((k) => !['event', 'when', 'condition', 'to'].includes(k)),
        )
        .map((e) => `${m.name}: ${JSON.stringify(e)}`),
    );
    expect(bad).toEqual([]);
  });

  it('carries a condition exactly when the event is not always sent', () => {
    const bad = METHODS.flatMap((m) =>
      emitsOf(m)
        .filter((e) => {
          const hasCondition = typeof e.condition === 'string' && e.condition.trim() !== '';
          return hasCondition !== (e.when !== 'always') || ('condition' in e && !hasCondition);
        })
        .map((e) => `${m.name}: ${e.event}`),
    );
    expect(bad).toEqual([]);
  });

  it('lists an event for the same recipients at most once per method', () => {
    const bad = METHODS.flatMap((m) => {
      const keys = emitsOf(m).map((e) => `${e.event}->${e.to}`);
      return keys.filter((k, i) => keys.indexOf(k) !== i).map((k) => `${m.name}: ${k}`);
    });
    expect(bad).toEqual([]);
  });

  it('never lists RequestResponse, which answers every wrapped Request', () => {
    const bad = METHODS.filter((m) => emitsOf(m).some((e) => e.event === 'RequestResponse')).map(
      (m) => m.name,
    );
    expect(bad).toEqual([]);
  });

  it('has read methods emit nothing, except the JoinScenarioSession replay to the caller', () => {
    const reads = METHODS.filter((m) => m['x-stpSafety'] === 'read');
    const emitting = reads.filter((m) => emitsOf(m).length > 0).map((m) => m.name);
    expect(emitting).toEqual(['JoinScenarioSession']);
    const join = reads.find((m) => m.name === 'JoinScenarioSession')!;
    expect(emitsOf(join).every((e) => e.to === 'caller')).toBe(true);
    expect(emitsOf(join).map((e) => e.event)).not.toContain('TaskOrgAdded');
  });

  it('never has NewScenario delivered to the caller unconditionally', () => {
    const bad = METHODS.flatMap((m) =>
      emitsOf(m)
        .filter((e) => e.event === 'NewScenario' && (e.when === 'always' || e.to === 'caller'))
        .map(() => m.name),
    );
    expect(bad).toEqual([]);
  });

  it('places x-stpEmits right after the safety, open-world and inform markers', () => {
    const bad = METHODS.filter((m) => {
      const keys = Object.keys(m);
      const anchor = Math.max(
        ...['x-stpSafety', 'x-stpOpenWorld', 'x-stpInform'].map((k) => keys.indexOf(k)),
      );
      if (keys[anchor + 1] !== 'x-stpEmits') return true;
      return 'x-stpKnownIssues' in m && keys[anchor + 2] !== 'x-stpKnownIssues';
    }).map((m) => m.name);
    expect(bad).toEqual([]);
  });

  it('names known issues by ticket key only', () => {
    const bad = METHODS.filter((m) => 'x-stpKnownIssues' in m).flatMap((m) => {
      const issues = m['x-stpKnownIssues'];
      if (!Array.isArray(issues) || issues.length === 0) return [`${m.name}: not a non-empty array`];
      return issues.filter((k: unknown) => typeof k !== 'string' || !/^STP-\d+$/.test(k)).map(
        (k: unknown) => `${m.name}: ${String(k)}`,
      );
    });
    expect(bad).toEqual([]);
  });

  it('flags the COA calls whose events the engine does not deliver yet', () => {
    const flagged = METHODS.filter((m) => (m['x-stpKnownIssues'] ?? []).includes('STP-1078'))
      .map((m) => m.name)
      .filter((n) => /Coa$/.test(n))
      .sort(byName);
    expect(flagged).toEqual(['AddCoa', 'DeleteCoa', 'UpdateCoa']);
  });
});
