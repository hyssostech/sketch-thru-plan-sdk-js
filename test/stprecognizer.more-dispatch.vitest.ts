import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

class MockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  async connect(serviceName: string): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return 'DISPATCH-2';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

describe('StpRecognizer additional dispatch cases', () => {
  it('TaskOrgAdded invokes handler with StpTaskOrg', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: StpType.StpTaskOrg | undefined;
    recognizer.onTaskOrgAdded = (to) => { received = to; };
    await recognizer.connect('Svc', 1);
    const toProps: any = { poid: 'TO1', name: 'Org' };
    connector.onInform?.(JSON.stringify({ method: 'TaskOrgAdded', params: { taskOrg: toProps, isUndo: false } }));
    expect(received).toBeInstanceOf(StpType.StpTaskOrg);
    expect(received?.poid).toBe('TO1');
  });

  it('TaskAdded invokes handler with StpTask alternates', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; alts?: StpType.StpTask[]; taskPoids?: string[]; isUndo?: boolean } = {};
    recognizer.onTaskAdded = (poid, alts, taskPoids, isUndo) => { payload = { poid, alts, taskPoids, isUndo }; };
    await recognizer.connect('Svc', 1);
    const taskProps: any = { poid: 'T1', name: 'Task' };
    connector.onInform?.(JSON.stringify({ method: 'TaskAdded', params: { poid: 'ROOT', alternates: [taskProps], taskPoids: ['T1'], isUndo: false } }));
    expect(payload.poid).toBe('ROOT');
    expect(payload.alts?.[0]).toBeInstanceOf(StpType.StpTask);
    expect(payload.taskPoids).toEqual(['T1']);
  });

  it('CoaAdded invokes handler with raw coa object', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: { poid?: string; coa?: StpType.StpCoa; isUndo?: boolean } = {};
    recognizer.onCoaAdded = (poid, coa, isUndo) => { received = { poid, coa, isUndo }; };
    await recognizer.connect('Svc', 1);
    const coaProps: any = { poid: 'C1', name: 'COA' };
    connector.onInform?.(JSON.stringify({ method: 'CoaAdded', params: { poid: 'C1', coa: coaProps, isUndo: false } }));
    expect(received.poid).toBe('C1');
    expect(received.coa).toEqual({ poid: 'C1', name: 'COA' });
  });

  it('RoleSwitched invokes handler with role', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let role: StpType.StpRole | undefined;
    recognizer.onRoleSwitched = (r) => { role = r; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'RoleSwitched', params: { role: { name: 'Commander' } } }));
    expect(role?.name).toBe('Commander');
  });

  it('InkProcessed invokes handler', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let called = false;
    recognizer.onInkProcessed = () => { called = true; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'InkProcessed', params: {} }));
    expect(called).toBe(true);
  });

  it('SymbolReport invokes handler with StpSymbol', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; symbol?: StpType.StpSymbol } = {};
    recognizer.onSymbolReport = (poid, symbol) => { payload = { poid, symbol }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'SymbolReport', params: { poid: 'S1', symbol: { poid: 'S1', name: 'Unit' } } }));
    expect(payload.poid).toBe('S1');
    expect(payload.symbol).toBeInstanceOf(StpType.StpSymbol);
  });
});
