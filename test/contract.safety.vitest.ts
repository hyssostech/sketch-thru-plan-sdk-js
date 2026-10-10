import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * STP-1059. Every contract method says what it can do to state (x-stpSafety) and whether
 * the engine answers it (a result) or not (x-stpInform). Tool generators - the stp-mcp
 * server among them - read these to decide what runs without asking the user, so a method
 * missing either would be generated unclassified.
 */

const CONTRACT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'json-api', 'sketch-thru-plan-api.json'), 'utf8'),
);
const METHODS: Array<Record<string, any>> = CONTRACT.methods;

describe('contract safety classification (STP-1059)', () => {
  it('classifies every method as read, write or destructive', () => {
    const bad = METHODS.filter(
      (m) => !['read', 'write', 'destructive'].includes(m['x-stpSafety']),
    ).map((m) => m.name);
    expect(bad).toEqual([]);
  });

  it('gives every method either a result or the inform marker, never both', () => {
    const bad = METHODS.filter(
      (m) => ('result' in m) === (m['x-stpInform'] === true),
    ).map((m) => m.name);
    expect(bad).toEqual([]);
  });

  it('never calls a delete, a scenario load or an import anything but destructive', () => {
    const lax = METHODS.filter(
      (m) =>
        /^(Delete|Import|Load|Sync|CreateNew|ResetStpScenario|Push)/.test(m.name) &&
        m['x-stpSafety'] !== 'destructive',
    ).map((m) => m.name);
    expect(lax).toEqual([]);
  });

  it('never calls a Get method anything but read', () => {
    const lax = METHODS.filter(
      (m) => /^Get/.test(m.name) && m['x-stpSafety'] !== 'read',
    ).map((m) => m.name);
    expect(lax).toEqual([]);
  });

  it('lists exactly the calls that reach outside STP', () => {
    const open = METHODS.filter((m) => m['x-stpOpenWorld'] === true).map((m) => m.name).sort();
    expect(open).toEqual(['PullC2SIMInitialization', 'PushC2SIMContent']);
  });
});
