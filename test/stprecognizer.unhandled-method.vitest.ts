import { describe, it, expect, vi, afterEach } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

/**
 * What happens to a message no handler consumes.
 *
 * The dispatcher is an else-if chain where every branch tests BOTH the method
 * and that a handler is subscribed. A consumer who subscribes to three events
 * out of thirty-five therefore falls through to the terminal else for the other
 * thirty-two - which is entirely normal traffic, not an error.
 *
 * That branch used to `console.log`, unconditionally, in a browser SDK. It
 * bypassed onStpMessage - the SDK's own diagnostic channel, which the consumer
 * can route wherever they like - and it could not be turned off.
 *
 * sdk-net reports the same situation through its channel at Debug level
 * ("Unhandled method: X"). These tests hold sdk-js to that.
 */

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
    return 'UNHANDLED';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

afterEach(() => { vi.restoreAllMocks(); });

describe('messages that no handler consumes', () => {
  it('does not write to the console', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    // A perfectly ordinary event the consumer simply did not subscribe to.
    connector.onInform?.(JSON.stringify({
      method: 'SymbolAdded',
      params: { poid: 's1', alternates: [{ poid: 's1' }], isUndo: false },
    }));

    expect(spy).not.toHaveBeenCalled();
  });

  it('reports through onStpMessage instead, at Debug level', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    const seen: { message: string; level: StpType.StpMessageLevel }[] = [];
    recognizer.onStpMessage = (message, level) => { seen.push({ message, level }); };
    await recognizer.connect('Svc', 1);

    connector.onInform?.(JSON.stringify({
      method: 'SomeMethodThisBuildDoesNotKnow',
      params: {},
    }));

    const reported = seen.find((s) => s.message.includes('SomeMethodThisBuildDoesNotKnow'));
    expect(reported).toBeDefined();
    expect(reported?.level).toBe(StpType.StpMessageLevel.Debug);
  });

  it('stays silent when nobody is listening on the channel either', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    // No onStpMessage subscriber: the SDK must not fall back to the console.
    connector.onInform?.(JSON.stringify({ method: 'AlsoUnknown', params: {} }));

    expect(spy).not.toHaveBeenCalled();
  });
});
