import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';
import type { ISpeechRecoItem } from '../src/interfaces/ISpeechRecognizer';

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
    return 'NEWEVENTS-SESSION';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

describe('StpRecognizer new engine events (NewScenario, SpeechDiscarded, SpeechParsed)', () => {
  it('NewScenario invokes handler with no arguments', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let called = false;
    recognizer.onNewScenario = () => { called = true; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'NewScenario', params: {} }));

    expect(called).toBe(true);
  });

  it('SpeechDiscarded invokes handler with no arguments', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let called = false;
    recognizer.onSpeechDiscarded = () => { called = true; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'SpeechDiscarded', params: {} }));

    expect(called).toBe(true);
  });

  it('SpeechParsed invokes handler with the alternates array', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: ISpeechRecoItem[] | undefined;
    recognizer.onSpeechParsed = (alternates) => { received = alternates; };

    await recognizer.connect('Svc', 1);
    const alternates: ISpeechRecoItem[] = [
      { text: 'alpha company attack', confidence: 0.91 },
      { text: 'alpha company attach', confidence: 0.4 },
    ];
    connector.onInform?.(JSON.stringify({ method: 'SpeechParsed', params: { alternates } }));

    expect(received).toEqual(alternates);
    expect(received?.length).toBe(2);
  });

  it('does nothing when no handler is assigned for the new events (no throw)', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    expect(() => {
      connector.onInform?.(JSON.stringify({ method: 'NewScenario', params: {} }));
      connector.onInform?.(JSON.stringify({ method: 'SpeechDiscarded', params: {} }));
      connector.onInform?.(JSON.stringify({ method: 'SpeechParsed', params: { alternates: [] } }));
    }).not.toThrow();
  });
});

describe('StpRecognizer CoaSwitched dispatch (restored)', () => {
  it('CoaSwitched invokes handler with the StpCoa payload', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: StpType.StpCoa | undefined;
    recognizer.onCoaSwitched = (coa) => { received = coa; };

    await recognizer.connect('Svc', 1);
    const coaProps: any = { poid: 'COA1', name: 'Main Attack', affiliation: 'friend' };
    connector.onInform?.(JSON.stringify({ method: 'CoaSwitched', params: { coa: coaProps } }));

    expect(received?.poid).toBe('COA1');
    expect(received?.name).toBe('Main Attack');
  });
});

describe('StpRecognizer buildSolvables includes the new/restored events', () => {
  it('subscribes to NewScenario, SpeechDiscarded, SpeechParsed and CoaSwitched once handlers are assigned', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);

    recognizer.onNewScenario = () => {};
    recognizer.onSpeechDiscarded = () => {};
    recognizer.onSpeechParsed = () => {};
    recognizer.onCoaSwitched = () => {};

    await recognizer.connect('Svc', 1);

    expect(connector.lastSolvables).toContain('NewScenario');
    expect(connector.lastSolvables).toContain('SpeechDiscarded');
    expect(connector.lastSolvables).toContain('SpeechParsed');
    expect(connector.lastSolvables).toContain('CoaSwitched');
  });

  it('does NOT subscribe to events for which no handler was assigned', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    // No handlers assigned at all
    await recognizer.connect('Svc', 1);

    expect(connector.lastSolvables).not.toContain('NewScenario');
    expect(connector.lastSolvables).not.toContain('SpeechDiscarded');
    expect(connector.lastSolvables).not.toContain('SpeechParsed');
    expect(connector.lastSolvables).not.toContain('CoaSwitched');
  });
});
