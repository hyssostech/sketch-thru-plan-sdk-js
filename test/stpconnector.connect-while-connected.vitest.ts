import { describe, it, expect } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';

declare const global: any;
global.WebSocket = MockWebSocket as unknown as WebSocket;

/*
 * STP-755. connect() on an already-connected instance.
 *
 * The executor resolved the caller's promise inside `if (this.isConnected)` and
 * then carried on to the end of the function, because there was no `return`
 * under the comment that said "Bail out if already connected". The caller was
 * told it had succeeded while a SECOND WebSocket was still being opened
 * underneath it, every socket handler was reassigned to the new socket, and
 * this.sessionId changed AFTER the caller had already been handed the old one.
 *
 * These tests pin down the behaviour that replaces it, not merely the absence
 * of the second socket. The choice made - see the ticket's (a)/(b)/(c) - is
 * (b): a redundant connect() UPDATES the registration without reconnecting,
 * which is exactly what updateSolvables() already does. (a), a pure no-op,
 * would have silently discarded the new solvables for any caller relying on
 * today's accidental side effect.
 */

const WS_BASE = 26400;
let port = WS_BASE;
const nextUrl = () => `ws://localhost:${port++}`;

/**
 * A server that records every Register it receives and hands back a distinct
 * session id each time, so a stale resolve is distinguishable from a fresh one.
 */
function registerRecordingServer(url: string) {
  const registers: any[] = [];
  const connections: any[] = [];
  const server = new Server(url);
  server.on('connection', (socket) => {
    connections.push(socket);
    socket.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);
        if (msg?.method !== 'Request') return;
        const cookie = msg.params?.cookie;
        const inner = JSON.parse(msg.params?.jsonRequest ?? '{}');
        if (inner.method !== 'Register') return;
        registers.push(inner.params);
        socket.send(
          JSON.stringify({
            method: 'RequestResponse',
            params: { cookie, success: true, result: `SESSION-${registers.length}` },
          })
        );
      } catch {
        /* ignore */
      }
    });
  });
  return { server, registers, connections };
}

describe('StpWebSocketsConnector.connect() while already connected', () => {
  it('does NOT open a second socket', async () => {
    const url = nextUrl();
    const { server, connections } = registerRecordingServer(url);

    const connector = new StpWebSocketsConnector(url);
    await connector.connect('Svc', ['Foo']);
    expect(connections.length).toBe(1);

    await connector.connect('Svc', ['Foo']);

    // Give any stray socket time to actually connect before asserting, so this
    // cannot pass merely by being checked too early.
    await new Promise((r) => setTimeout(r, 60));

    expect(connections.length).toBe(1);

    server.stop();
  });

  it('applies the new solvables by re-registering, rather than discarding them', async () => {
    const url = nextUrl();
    const { server, registers } = registerRecordingServer(url);

    const connector = new StpWebSocketsConnector(url);
    await connector.connect('Svc', ['Foo']);
    expect(registers.length).toBe(1);
    expect(registers[0].solvables).toEqual(['Foo']);

    await connector.connect('Svc', ['Foo', 'CoaSwitched']);

    expect(registers.length).toBe(2);
    expect(registers[1].solvables).toEqual(['Foo', 'CoaSwitched']);
    expect(connector.solvables).toEqual(['Foo', 'CoaSwitched']);

    server.stop();
  });

  it('resolves with the CURRENT session id, not the one from before the call', async () => {
    const url = nextUrl();
    const { server } = registerRecordingServer(url);

    const connector = new StpWebSocketsConnector(url);
    const first = await connector.connect('Svc', ['Foo']);
    expect(first).toBe('SESSION-1');

    // The old code resolved with this.sessionId BEFORE re-registering, so the
    // caller received SESSION-1 while the connector went on to hold SESSION-2.
    const second = await connector.connect('Svc', ['Foo', 'Bar']);

    expect(second).toBe('SESSION-2');
    expect(connector.sessionId).toBe('SESSION-2');
    expect(second).toBe(connector.sessionId);

    server.stop();
  });

  it('honours an explicitly supplied machineId on the redundant call', async () => {
    const url = nextUrl();
    const { server, registers } = registerRecordingServer(url);

    const connector = new StpWebSocketsConnector(url);
    await connector.connect('Svc', ['Foo'], 10, 'MACHINE-A');
    expect(registers[0].machineId).toBe('MACHINE-A');

    await connector.connect('Svc', ['Foo'], 10, 'MACHINE-B');

    expect(registers.length).toBe(2);
    expect(registers[1].machineId).toBe('MACHINE-B');

    server.stop();
  });

  it('leaves the live socket in place - the connection is not disturbed', async () => {
    const url = nextUrl();
    const { server, connections } = registerRecordingServer(url);

    const connector = new StpWebSocketsConnector(url);
    await connector.connect('Svc', ['Foo']);
    const socketBefore = (connector as any).socket;

    await connector.connect('Svc', ['Foo']);

    // The wait is load-bearing. Against the unfixed code this assertion PASSED
    // for the wrong reason: the redundant connect() resolved the caller at the
    // top of the executor and only replaced this.socket later, asynchronously,
    // so checking immediately caught the old socket still in place. A test that
    // passes on the broken code measures nothing.
    await new Promise((r) => setTimeout(r, 60));

    expect((connector as any).socket).toBe(socketBefore);
    expect(connector.isConnected).toBe(true);
    expect(connections.length).toBe(1);

    server.stop();
  });

  it('still reconnects normally after a close - the guard must not block the reconnect path', async () => {
    const url = nextUrl();
    const { server, connections } = registerRecordingServer(url);

    const connector = new StpWebSocketsConnector(url);
    await connector.connect('Svc', ['Foo']);
    expect(connector.isConnected).toBe(true);

    // onclose calls connect() again. Inside onclose the socket is CLOSED, so
    // isConnected is false and the new early return must not fire.
    await new Promise((r) => setTimeout(r, 10));
    connections[0].close();

    const start = Date.now();
    while (Date.now() - start < 800 && !connector.isConnected) {
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(connector.isConnected).toBe(true);
    expect(connections.length).toBeGreaterThan(1);

    server.stop();
  });
});
