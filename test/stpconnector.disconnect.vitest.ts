import { describe, it, expect, vi } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';

// STP-1070. disconnect() closed the socket only when it was NOT open, so a live
// connection stayed open after disconnect().

const CONNECTING = 0, OPEN = 1, CLOSING = 2, CLOSED = 3;

/** A WebSocket stand-in whose readyState the test sets, with close() spied. */
function fakeSocket(readyState: number) {
  const sock: any = {
    CONNECTING, OPEN, CLOSING, CLOSED,
    readyState,
    onclose: null,
    close: vi.fn(() => {
      // Mirror the browser: close() on CLOSING/CLOSED is a no-op
      if (sock.readyState === CLOSING || sock.readyState === CLOSED) return;
      sock.readyState = CLOSED;
    }),
  };
  return sock;
}

function connectorWith(sock: any): StpWebSocketsConnector {
  const c = new StpWebSocketsConnector('wss://unused');
  c.socket = sock as WebSocket;
  return c;
}

describe('StpWebSocketsConnector.disconnect (STP-1070)', () => {
  it('closes an OPEN socket', async () => {
    const sock = fakeSocket(OPEN);
    const c = connectorWith(sock);
    expect(c.isConnected).toBe(true);
    await c.disconnect(1);
    expect(sock.close).toHaveBeenCalledTimes(1);
    expect(c.isConnected).toBe(false);
  });

  it('closes a CONNECTING socket', async () => {
    const sock = fakeSocket(CONNECTING);
    const c = connectorWith(sock);
    await c.disconnect(1);
    expect(sock.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['CLOSING', CLOSING],
    ['CLOSED', CLOSED],
  ])('does not close again or throw when the socket is %s', async (_name, state) => {
    const sock = fakeSocket(state);
    const c = connectorWith(sock);
    await expect(c.disconnect(1)).resolves.toBeUndefined();
    expect(sock.close).not.toHaveBeenCalled();
  });

  it('resolves when there is no socket', async () => {
    const c = new StpWebSocketsConnector('wss://unused');
    await expect(c.disconnect(1)).resolves.toBeUndefined();
  });

  it('a second disconnect() does not close again', async () => {
    const sock = fakeSocket(OPEN);
    const c = connectorWith(sock);
    await c.disconnect(1);
    await c.disconnect(1);
    expect(sock.close).toHaveBeenCalledTimes(1);
  });

  it('a live connection stays closed: disconnect() does not trigger the auto-reconnect', async () => {
    (globalThis as any).WebSocket = MockWebSocket as unknown as WebSocket;
    const url = 'wss://localhost:22370';
    const server = new Server(url);
    let connections = 0;
    server.on('connection', (socket) => {
      connections++;
      socket.on('message', (data: string) => {
        const msg = JSON.parse(data);
        if (msg?.method === 'Request') {
          socket.send(JSON.stringify({
            method: 'RequestResponse',
            params: { cookie: msg.params.cookie, success: true, result: 'SESSION-1070' },
          }));
        }
      });
    });
    try {
      const c = new StpWebSocketsConnector(url);
      const errors: string[] = [];
      c.onError = (m) => errors.push(m);
      await c.connect('Svc', ['Foo']);
      expect(c.isConnected).toBe(true);
      expect(connections).toBe(1);

      await c.disconnect(1);
      // Give a would-be reconnect from onclose time to happen
      await new Promise((r) => setTimeout(r, 150));

      expect(c.isConnected).toBe(false);
      expect(c.isConnecting).toBe(false);
      expect(connections).toBe(1);
      expect(errors).toEqual([]);

      // connect() after a disconnect() still works, and reconnects on loss again
      await c.connect('Svc', ['Foo']);
      expect(c.isConnected).toBe(true);
      expect(connections).toBe(2);
      await c.disconnect(1);
    } finally {
      server.stop();
    }
  });
});
