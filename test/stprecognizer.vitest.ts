import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import { StpMessageLevel } from '../src/stptypes';

class MockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;

  lastSolvables: string[] = [];

  async connect(serviceName: string, solvables: string[], timeout?: number, machineId?: string | null, sessionId?: string | null): Promise<string | undefined> {
    this.name = serviceName;
    this.lastSolvables = solvables;
    this.isConnected = true;
    return Promise.resolve('MOCK-SESSION');
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(message: string): Promise<void> { /* no-op */ }
  async request(message: string): Promise<any> { return { ok: true }; }
}

describe('StpRecognizer', () => {
  it('connect wires handlers and derives solvables from assigned callbacks', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);

    // Assign some handlers
    recognizer.onSpeechRecognized = () => {};
    recognizer.onSymbolDeleted = () => {};
    recognizer.onTaskOrgAdded = () => {};

    const sessionId = await recognizer.connect('Svc', 1);
    expect(sessionId).toBe('MOCK-SESSION');
    expect(connector.isConnected).toBe(true);
    // Should include the names without 'on' prefix
    expect(connector.lastSolvables).toEqual(expect.arrayContaining(['SpeechRecognized', 'SymbolDeleted', 'TaskOrgAdded']));
  });

  it('onInform dispatches to onStpMessage handler', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: { message?: string; level?: StpMessageLevel } = {};
    recognizer.onStpMessage = (m, l) => { received = { message: m, level: l }; };

    await recognizer.connect('Svc', 1);
    // Simulate an incoming message
    connector.onInform?.(JSON.stringify({ method: 'StpMessage', params: { message: 'hello', level: StpMessageLevel.Info } }));

    expect(received.message).toBe('hello');
    expect(received.level).toBe(StpMessageLevel.Info);
  });

  it('unknown message type is safely ignored (no crash)', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);
    // Should not throw when an unrecognized type is received
    connector.onInform?.(JSON.stringify({ method: 'UnknownType', params: { foo: 'bar' } }));
    expect(connector.isConnected).toBe(true);
  });
});
