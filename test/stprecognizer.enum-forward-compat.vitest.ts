import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

/**
 * Forward compatibility for enum values on the wire.
 *
 * The engine serialises enums by name, so an engine NEWER than the SDK sends
 * member names this build does not know. The contract is that an unknown name
 * must not take the surrounding event with it - a new task type should still
 * arrive as a task.
 *
 * This is tested here because the .NET SDK got it wrong and nobody noticed:
 * its NullSafeStringEnumConverter returned null for a non-nullable enum, which
 * Newtonsoft 13.0.3 tolerated and 13.0.4 rejected, so the whole TaskAdded was
 * silently dropped. It was only covered there by accident, by one dispatch test
 * that happened to use an unknown name. sdk-js should not rely on an accident
 * either.
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
    return 'ENUM-FWD';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

// Deliberately NOT a member of TaskWhat. If it ever becomes one, the guard
// below fails loudly rather than the test quietly ceasing to test anything.
const UNKNOWN_WHAT = 'ATTACK';

describe('enum forward compatibility', () => {
  it('the value used here is genuinely unknown to this build', () => {
    expect(Object.values(StpType.TaskWhat)).not.toContain(UNKNOWN_WHAT);
  });

  it('an unknown enum name does not drop the TaskAdded event', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);

    let invoked = false;
    let payload: { poid?: string; alts?: StpType.StpTask[]; taskPoids?: string[] } = {};
    recognizer.onTaskAdded = (poid, alts, taskPoids) => {
      invoked = true;
      payload = { poid, alts, taskPoids };
    };
    await recognizer.connect('Svc', 1);

    connector.onInform?.(JSON.stringify({
      method: 'TaskAdded',
      params: {
        poid: 'task-1',
        alternates: [{ fsTYPE: 'task', poid: 'task-1', name: 'Attack', what: UNKNOWN_WHAT }],
        taskPoids: ['tg-1'],
        isUndo: false,
      },
    }));

    // The point of the test: the handler ran at all.
    expect(invoked).toBe(true);
    expect(payload.poid).toBe('task-1');
    expect(payload.alts?.[0]).toBeInstanceOf(StpType.StpTask);
    expect(payload.alts?.[0]?.name).toBe('Attack');
    expect(payload.taskPoids).toEqual(['tg-1']);
  });

  it('a known enum name still resolves', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let alts: StpType.StpTask[] | undefined;
    recognizer.onTaskAdded = (_poid, a) => { alts = a; };
    await recognizer.connect('Svc', 1);

    const known = StpType.TaskWhat.AMBUSH;
    connector.onInform?.(JSON.stringify({
      method: 'TaskAdded',
      params: {
        poid: 'task-2',
        alternates: [{ fsTYPE: 'task', poid: 'task-2', name: 'Ambush', what: known }],
        taskPoids: [],
        isUndo: false,
      },
    }));

    expect(alts?.[0]?.what).toBe(known);
  });

  it('records HOW an unknown value surfaces - the SDKs differ here', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let alts: StpType.StpTask[] | undefined;
    recognizer.onTaskAdded = (_poid, a) => { alts = a; };
    await recognizer.connect('Svc', 1);

    connector.onInform?.(JSON.stringify({
      method: 'TaskAdded',
      params: {
        poid: 'task-3',
        alternates: [{ fsTYPE: 'task', poid: 'task-3', name: 'Attack', what: UNKNOWN_WHAT }],
        taskPoids: [],
        isUndo: false,
      },
    }));

    // sdk-js builds models with Object.assign, so there is no conversion step
    // that could reject the value: the raw string survives. The .NET SDK
    // converts, and an unknown name lands as the enum's default - losing it.
    // Neither drops the event, which is the contract; but a consumer reading
    // this field cross-platform gets different answers, and that is worth
    // having written down rather than discovered.
    expect(alts?.[0]?.what as unknown as string).toBe(UNKNOWN_WHAT);
  });
});
