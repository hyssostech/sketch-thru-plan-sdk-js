import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

/**
 * STP-1024. A task as the engine actually sends it, and as it reads it back.
 *
 * The WebSockets bridge (STP BridgingAgents/WebSocketsBridge/StpJsonClient.cs, JsonTask)
 * writes `what=t.What.ToString()` and friends, so the enums arrive as the C# member names -
 * "AMBUSH", "CORDON_AND_SEARCH", "Hold" - and ROE arrives under the key `roe`. Until 0.6.17
 * the enum values here were lower case and the field was `rulesOfEngagement`, so no
 * comparison against these enums ever matched a live task and ROE was never populated.
 */

class MockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  sent: string[] = [];
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  connect(serviceName: string): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return Promise.resolve('TASK-WIRE');
  }
  disconnect(): Promise<void> { this.isConnected = false; return Promise.resolve(); }
  inform(message: string): Promise<void> { this.sent.push(message); return Promise.resolve(); }
  request(): Promise<any> { return Promise.resolve({ ok: true }); }
}

// The keys and value spellings of StpJsonClient.JsonTask.
const WIRE_TASK = {
  fsTYPE: 'task',
  poid: 'task-1',
  name: 'AmbushObjective',
  what: 'AMBUSH',
  how: 'CORDON_AND_SEARCH',
  why: 'PROTECT',
  roe: 'Hold',
};

describe('task wire format (STP-1024)', () => {
  it('a TaskAdded from the engine compares equal to the enums', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let alts: StpType.StpTask[] | undefined;
    recognizer.onTaskAdded = (_poid, a) => { alts = a; };
    await recognizer.connect('Svc', 1);

    connector.onInform?.(JSON.stringify({
      method: 'TaskAdded',
      params: { poid: 'task-1', alternates: [WIRE_TASK], taskPoids: [], isUndo: false },
    }));

    const task = alts?.[0];
    expect(task?.what).toBe(StpType.TaskWhat.Ambush);
    expect(task?.how).toBe(StpType.TaskHow.CordonAndSearch);
    expect(task?.why).toBe(StpType.TaskWhy.Protect);
    expect(task?.roe).toBe(StpType.TaskROE.Hold);
    // The deprecated name reads the same value.
    expect(task?.rulesOfEngagement).toBe(StpType.TaskROE.Hold);
  });

  it('a task sent to the engine carries roe under the key the engine reads', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const task = new StpType.StpTask();
    task.what = StpType.TaskWhat.Ambush;
    task.rulesOfEngagement = StpType.TaskROE.Free; // the old name still writes through
    recognizer.addTask(task);

    const sent = JSON.parse(connector.sent.at(-1)!);
    expect(sent.params.task.what).toBe('AMBUSH');
    expect(sent.params.task.roe).toBe('Free');
    expect(sent.params.task).not.toHaveProperty('rulesOfEngagement');
  });

  it('every What/How/Why value is an upper-snake member name', () => {
    for (const e of [StpType.TaskWhat, StpType.TaskHow, StpType.TaskWhy]) {
      for (const v of Object.values(e)) {
        expect(v).toMatch(/^[A-Z][A-Z_]*$/);
      }
    }
    // ROE's engine members are mixed case.
    expect(new Set(Object.values(StpType.TaskROE))).toEqual(new Set(['NOT_SPECIFIED', 'Hold', 'Free', 'Tight']));
  });
});
