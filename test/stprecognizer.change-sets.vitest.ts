import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

/**
 * STP-1265 (engine change sets, D143 (a)). The engine groups a bulk operation's object events into a change set:
 * BatchStarted and BatchEnded bracket it, and every object event carries the batchId of the change it arrived in
 * (null outside one). The batchId reaches the handlers as an optional trailing argument, so existing handlers are
 * unaffected.
 */

class MockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  lastSolvables: string[] = [];
  async connect(serviceName: string, solvables: string[]): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    this.lastSolvables = solvables;
    return 'CHANGESET-SESSION';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

async function connected(setup: (r: StpRecognizer) => void): Promise<{ r: StpRecognizer; c: MockConnector }> {
  const c = new MockConnector();
  const r = new StpRecognizer(c);
  setup(r);
  await r.connect('Svc', 1);
  return { r, c };
}

const send = (c: MockConnector, method: string, params: object) => c.onInform?.(JSON.stringify({ method, params }));

describe('change sets (STP-1265)', () => {
  it('BatchStarted reaches onBatchStarted with the batch', async () => {
    let got: StpType.StpBatchStarted | undefined;
    const { c } = await connected((r) => { r.onBatchStarted = (b) => { got = b; }; });

    send(c, 'BatchStarted', { batchId: 'b1', kind: 'reconcile', expected: 40, isOwn: false, origin: 'live' });

    expect(got).toEqual({ batchId: 'b1', kind: 'reconcile', expected: 40, isOwn: false, origin: 'live' });
  });

  it('BatchEnded reaches onBatchEnded with how it ended', async () => {
    let got: StpType.StpBatchEnded | undefined;
    const { c } = await connected((r) => { r.onBatchEnded = (b) => { got = b; }; });

    send(c, 'BatchEnded', { batchId: 'b1', kind: 'reconcile', status: 'abandoned', informs: 12, isOwn: false, origin: 'live' });

    expect(got?.status).toBe('abandoned');
    expect(got?.informs).toBe(12);
    expect(got?.batchId).toBe('b1');
  });

  it('subscribes to the batch events only when their handlers are set', async () => {
    const { c } = await connected((r) => { r.onBatchStarted = () => {}; r.onBatchEnded = () => {}; });
    expect(c.lastSolvables).toEqual(expect.arrayContaining(['BatchStarted', 'BatchEnded']));

    const plain = await connected((r) => { r.onSymbolAdded = () => {}; });
    expect(plain.c.lastSolvables).not.toContain('BatchStarted');
  });

  it('passes an object event its batchId as a trailing argument', async () => {
    const seen: Array<string | undefined> = [];
    const { c } = await connected((r) => {
      r.onSymbolAdded = (_alts, _isUndo, batchId) => { seen.push(batchId); };
      r.onSymbolDeleted = (_poid, _isUndo, batchId) => { seen.push(batchId); };
      r.onTaskAdded = (_poid, _alts, _taskPoids, _isUndo, batchId) => { seen.push(batchId); };
      r.onTaskOrgUnitAdded = (_unit, _isUndo, batchId) => { seen.push(batchId); };
      r.onCoaDeleted = (_poid, _isUndo, batchId) => { seen.push(batchId); };
    });

    send(c, 'SymbolAdded', { alternates: [{ poid: 'idA' }], isUndo: false, batchId: 'b1' });
    send(c, 'SymbolDeleted', { poid: 'idA', isUndo: false, batchId: 'b1' });
    send(c, 'TaskAdded', { poid: 'idT', alternates: [{ poid: 'idT' }], taskPoids: ['idT'], isUndo: false, batchId: 'b2' });
    send(c, 'TaskOrgUnitAdded', { poid: 'idU', toUnit: { poid: 'idU' }, isUndo: false, batchId: 'b3' });
    send(c, 'CoaDeleted', { poid: 'idC', isUndo: false, batchId: 'b4' });

    expect(seen).toEqual(['b1', 'b1', 'b2', 'b3', 'b4']);
  });

  it('gives an object event outside a change set no batchId', async () => {
    const seen: Array<string | undefined> = ['sentinel'];
    const { c } = await connected((r) => { r.onSymbolDeleted = (_poid, _isUndo, batchId) => { seen[0] = batchId; }; });

    send(c, 'SymbolDeleted', { poid: 'idA', isUndo: false, batchId: null });
    expect(seen[0]).toBeUndefined();

    seen[0] = 'sentinel';
    send(c, 'SymbolDeleted', { poid: 'idA', isUndo: false });   // an engine that predates change sets
    expect(seen[0]).toBeUndefined();
  });
});

describe('contract change sets (STP-1265)', () => {
  const CONTRACT = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'json-api', 'sketch-thru-plan-api.json'), 'utf8'));
  const EVENTS: Array<{ name: string; params: Array<{ name: string }> }> = CONTRACT['x-stpEvents'];
  const event = (name: string) => EVENTS.find((e) => e.name === name);

  it('lists BatchStarted and BatchEnded with their params', () => {
    expect(event('BatchStarted')?.params.map((p) => p.name)).toEqual(['batchId', 'kind', 'expected', 'isOwn', 'origin']);
    expect(event('BatchEnded')?.params.map((p) => p.name)).toEqual(['batchId', 'kind', 'status', 'informs', 'isOwn', 'origin']);
  });

  it.each([
    'SymbolAdded', 'SymbolModified', 'SymbolDeleted',
    'TaskOrgAdded', 'TaskOrgModified', 'TaskOrgDeleted',
    'TaskOrgUnitAdded', 'TaskOrgUnitModified', 'TaskOrgUnitDeleted',
    'TaskOrgRelationshipAdded', 'TaskOrgRelationshipModified', 'TaskOrgRelationshipDeleted',
    'TaskAdded', 'TaskModified', 'TaskDeleted',
    'CoaAdded', 'CoaModified', 'CoaDeleted',
  ])('gives %s a trailing, nullable batchId', (name) => {
    const params = event(name)!.params as Array<{ name: string; schema: { type: unknown } }>;
    const last = params[params.length - 1];
    expect(last.name).toBe('batchId');
    expect(last.schema.type).toEqual(['string', 'null']);
  });
});
