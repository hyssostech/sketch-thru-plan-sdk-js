import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';

/**
 * Connector that additionally implements the optional updateSolvables() re-registration
 * entry point, recording every call so tests can inspect what was (re-)subscribed.
 */
class ReRegisteringMockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  updateSolvablesCalls: string[][] = [];

  async connect(serviceName: string, solvables: string[]): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return 'REFRESH-SESSION-1';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
  async updateSolvables(solvables: string[]): Promise<string> {
    this.updateSolvablesCalls.push(solvables);
    return 'REFRESH-SESSION-2';
  }
}

/** Connector that does NOT implement updateSolvables, like the older connectors. */
class NoRefreshMockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  async connect(serviceName: string, solvables: string[]): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return 'NOREFRESH-SESSION';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

describe('StpRecognizer.refreshSubscriptions', () => {
  it('throws a clear Error when called before a connection exists', async () => {
    const connector = new ReRegisteringMockConnector();
    const recognizer = new StpRecognizer(connector);

    await expect(recognizer.refreshSubscriptions()).rejects.toThrow(/not connected/i);
    expect(connector.updateSolvablesCalls.length).toBe(0);
  });

  it('throws a clear Error when the connector does not support updateSolvables', async () => {
    const connector = new NoRefreshMockConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    await expect(recognizer.refreshSubscriptions()).rejects.toThrow(/does not support/i);
  });

  it('rebuilds solvables from the CURRENT handler set and re-registers, picking up a handler attached after connect', async () => {
    const connector = new ReRegisteringMockConnector();
    const recognizer = new StpRecognizer(connector);

    // Handler present at connect time
    recognizer.onSpeechRecognized = () => {};
    await recognizer.connect('Svc', 1);

    // No re-registration has happened yet
    expect(connector.updateSolvablesCalls.length).toBe(0);

    // Attach a handler AFTER connect - per buildSolvables()/connect() semantics, this one would
    // never be part of the subscription set without an explicit refresh
    recognizer.onCoaSwitched = () => {};

    await recognizer.refreshSubscriptions();

    expect(connector.updateSolvablesCalls.length).toBe(1);
    const latest = connector.updateSolvablesCalls[0];
    expect(latest).toContain('CoaSwitched');
    expect(latest).toContain('SpeechRecognized');
  });
});
