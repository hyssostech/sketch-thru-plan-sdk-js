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
    return 'REMAINING';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

describe('StpRecognizer remaining dispatch cases', () => {
  it('SymbolModified invokes handler with StpSymbol', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; symbol?: StpType.StpSymbol; isUndo?: boolean } = {};
    recognizer.onSymbolModified = (poid, symbol, isUndo) => { payload = { poid, symbol, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'SymbolModified', params: { poid: 'S1', symbol: { poid: 'S1', name: 'Unit' }, isUndo: false } }));
    expect(payload.poid).toBe('S1');
    expect(payload.symbol).toBeInstanceOf(StpType.StpSymbol);
    expect(payload.isUndo).toBe(false);
  });

  it('SymbolDeleted invokes handler with poid/isUndo', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; isUndo?: boolean } = {};
    recognizer.onSymbolDeleted = (poid, isUndo) => { payload = { poid, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'SymbolDeleted', params: { poid: 'S2', isUndo: true } }));
    expect(payload.poid).toBe('S2');
    expect(payload.isUndo).toBe(true);
  });

  it('TaskModified invokes handler with StpTask alternates', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; alts?: StpType.StpTask[]; taskPoids?: string[]; isUndo?: boolean } = {};
    recognizer.onTaskModified = (poid, alts, taskPoids, isUndo) => { payload = { poid, alts, taskPoids, isUndo }; };
    await recognizer.connect('Svc', 1);
    const taskProps: any = { poid: 'T2', name: 'Task2' };
    connector.onInform?.(JSON.stringify({ method: 'TaskModified', params: { poid: 'ROOT', alternates: [taskProps], taskPoids: ['T2'], isUndo: true } }));
    expect(payload.poid).toBe('ROOT');
    expect(payload.alts?.[0]).toBeInstanceOf(StpType.StpTask);
    expect(payload.taskPoids).toEqual(['T2']);
    expect(payload.isUndo).toBe(true);
  });

  it('TaskDeleted invokes handler with poid/isUndo', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; isUndo?: boolean } = {};
    recognizer.onTaskDeleted = (poid, isUndo) => { payload = { poid, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'TaskDeleted', params: { poid: 'T3', isUndo: false } }));
    expect(payload.poid).toBe('T3');
    expect(payload.isUndo).toBe(false);
  });

  it('CoaModified invokes handler with StpCoa', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; coa?: StpType.StpCoa; isUndo?: boolean } = {};
    recognizer.onCoaModified = (poid, coa, isUndo) => { payload = { poid, coa, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'CoaModified', params: { poid: 'C2', coa: { poid: 'C2', name: 'COA2' }, isUndo: false } }));
    expect(payload.poid).toBe('C2');
    expect(payload.coa).toBeInstanceOf(StpType.StpCoa);
  });

  it('CoaDeleted invokes handler with poid/isUndo', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; isUndo?: boolean } = {};
    recognizer.onCoaDeleted = (poid, isUndo) => { payload = { poid, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'CoaDeleted', params: { poid: 'C3', isUndo: true } }));
    expect(payload.poid).toBe('C3');
    expect(payload.isUndo).toBe(true);
  });
});
