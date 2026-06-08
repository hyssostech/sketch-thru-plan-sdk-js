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
  async connect(serviceName: string, solvables: string[]): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return 'DISPATCH-SESSION';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

describe('StpRecognizer dispatch', () => {
  it('SymbolAdded invokes handler with StpSymbol instances', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: { alts?: StpType.StpSymbol[]; isUndo?: boolean } = {};
    recognizer.onSymbolAdded = (alts, isUndo) => { received = { alts, isUndo }; };

    await recognizer.connect('Svc', 1);
    const symbolProps = { poid: 'P1', name: 'Unit', affiliation: 'Friendly' } as any;
    connector.onInform?.(JSON.stringify({ method: 'SymbolAdded', params: { alternates: [symbolProps], isUndo: false } }));

    expect(received.alts?.length).toBe(1);
    expect(received.alts?.[0]).toBeInstanceOf(StpType.StpSymbol);
    expect(received.isUndo).toBe(false);
  });

  it('SpeechRecognized invokes handler', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let phrases: string[] = [];
    recognizer.onSpeechRecognized = (p) => { phrases = p; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'SpeechRecognized', params: { phrases: ['alpha', 'bravo'] } }));

    expect(phrases).toEqual(['alpha', 'bravo']);
  });

  it('MapOperation invokes handler with operation and location', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let op: string | undefined; let loc: StpType.Location | undefined;
    recognizer.onMapOperation = (o, l) => { op = o; loc = l; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'MapOperation', params: { operation: 'Pan', location: { lat: 1.23, lon: 4.56 } } }));

    expect(op).toBe('Pan');
    expect(loc?.lat).toBe(1.23);
    expect(loc?.lon).toBe(4.56);
  });
});
