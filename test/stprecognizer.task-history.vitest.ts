import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

/**
 * STP-1261 / STP-1260 (the task history, STP-1250). A client hears every history entry as TaskEventAdded and a
 * comment's edit or delete as TaskEventModified; it reads a task's history and adds, edits and deletes its own
 * comments; and the person it registers as (the connector's user) is the author the history names.
 */

type Wire = IStpConnector & { lastSolvables: string[]; requests: string[] };

// A connector that records what connect() and request() were given and lets a test push informs.
const wire = (answer: unknown = null): Wire => {
  const w: Wire = {
    name: undefined,
    isConnected: false,
    lastSolvables: [],
    requests: [],
    onInform: undefined,
    onRequest: undefined,
    onError: undefined,
    connect: async (serviceName, solvables) => {
      Object.assign(w, { name: serviceName, isConnected: true, lastSolvables: solvables });
      return 'S';
    },
    disconnect: async () => { w.isConnected = false; },
    inform: async () => undefined,
    request: async (msg: string) => { w.requests.push(msg); return answer; },
  };
  return w;
};

async function connected(setup: (r: StpRecognizer) => void, answer?: unknown): Promise<{ r: StpRecognizer; c: Wire }> {
  const c = wire(answer);
  const r = new StpRecognizer(c);
  setup(r);
  await r.connect('Svc', 1);
  return { r, c };
}

const send = (c: Wire, method: string, params: object) => c.onInform?.(JSON.stringify({ method, params }));

const comment: StpType.StpTaskHistoryEntry = {
  task: 'idTASK1', utc: '2026-10-19T01:00:00Z', kind: 'comment', origin: 'user', author: 'Pat', role: 's3',
  source: 'WebSocketsBridge', text: 'Hold until the bridge is clear', detail: '{}', edited: null, deleted: null,
};

describe('task history (STP-1261)', () => {
  it('TaskEventAdded reaches onTaskEventAdded with the entry poid, the entry and the batch', async () => {
    let got: unknown[] = [];
    const { c } = await connected((r) => { r.onTaskEventAdded = (...args) => { got = args; }; });

    send(c, 'TaskEventAdded', { poid: 'idEV1', entry: comment, batchId: 'b1' });

    expect(got).toEqual(['idEV1', comment, 'b1']);
  });

  it('TaskEventModified reaches onTaskEventModified; a deleted comment arrives as its tombstone', async () => {
    let got: { poid?: string; entry?: StpType.StpTaskHistoryEntry; batchId?: string } = {};
    const { c } = await connected((r) => { r.onTaskEventModified = (poid, entry, batchId) => { got = { poid, entry, batchId }; }; });
    const tombstone = { ...comment, text: null, detail: null, deleted: '2026-10-19T01:10:00Z' };

    send(c, 'TaskEventModified', { poid: 'idEV1', entry: tombstone, batchId: null });

    expect(got.poid).toBe('idEV1');
    expect(got.entry?.deleted).toBe('2026-10-19T01:10:00Z');
    expect(got.entry?.text).toBeNull();
    expect(got.batchId).toBeUndefined();
  });

  it('subscribes to the history events only when their handlers are set', async () => {
    const { c } = await connected((r) => { r.onTaskEventAdded = () => {}; r.onTaskEventModified = () => {}; });
    expect(c.lastSolvables).toEqual(expect.arrayContaining(['TaskEventAdded', 'TaskEventModified']));

    const plain = await connected((r) => { r.onTaskAdded = () => {}; });
    expect(plain.c.lastSolvables).not.toContain('TaskEventAdded');
  });

  it('sends the four history calls with the contract parameter names', async () => {
    const { r, c } = await connected(() => {}, []);

    await r.getTaskHistory('idTASK1');
    await r.addTaskComment('idTASK1', 'Hold');
    await r.editTaskComment('idEV1', 'Hold until 0700');
    await r.deleteTaskComment('idEV1');

    expect(c.requests.map((m) => JSON.parse(m))).toEqual([
      { method: 'GetTaskHistory', params: { taskPoid: 'idTASK1' } },
      { method: 'AddTaskComment', params: { taskPoid: 'idTASK1', text: 'Hold' } },
      { method: 'EditTaskComment', params: { entryPoid: 'idEV1', text: 'Hold until 0700' } },
      { method: 'DeleteTaskComment', params: { entryPoid: 'idEV1' } },
    ]);
  });

  it('returns the history as the engine answers it', async () => {
    const items: StpType.StpTaskHistoryItem[] = [{ poid: 'idEV1', entry: comment }];
    const { r } = await connected(() => {}, items);

    expect(await r.getTaskHistory('idTASK1')).toEqual(items);
  });
});

describe('the registered user (STP-1260)', () => {
  // The Register message the WebSockets connector sends, captured instead of opened on a socket.
  const registerOf = async (user: string | undefined): Promise<Record<string, unknown>> => {
    const c = new StpWebSocketsConnector('ws://localhost:0');
    c.user = user;
    c.serviceName = 'Svc';
    c.solvables = [];
    let sent = '';
    Object.defineProperty(c, 'isConnected', { get: () => true }); // register() refuses a closed socket
    (c as unknown as { request: (m: string) => Promise<unknown> }).request = async (m: string) => { sent = m; return 'S'; };
    await (c as unknown as { register: (t?: number) => Promise<unknown> }).register(1);
    return JSON.parse(sent).params;
  };

  it('Register carries the user, trimmed, when one is set', async () => {
    expect((await registerOf('  Pat  ')).user).toBe('Pat');
  });

  it('Register carries no user key when none is set, as before', async () => {
    expect(await registerOf(undefined)).not.toHaveProperty('user');
    expect(await registerOf('   ')).not.toHaveProperty('user');
  });
});
