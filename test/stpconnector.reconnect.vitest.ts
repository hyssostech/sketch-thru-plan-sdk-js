import { describe, it, expect } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';

declare const global: any;
global.WebSocket = MockWebSocket as unknown as WebSocket;

const WS_URL1 = 'ws://localhost:22345';
const WS_URL2 = 'ws://localhost:22346';
const WS_URL3 = 'ws://localhost:22349';

function createServer(url: string, onConn?: (socket: any) => void): { server: Server } {
  const server = new Server(url);
  server.on('connection', (socket) => {
    if (onConn) onConn(socket);
    socket.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);
        if (msg && msg.method === 'Request') {
          const cookie = msg.params?.cookie;
          const payload = msg.params?.jsonRequest;
          let inner;
          try { inner = JSON.parse(payload); } catch { inner = { method: 'Unknown' }; }
          const result = inner.method === 'Register' ? 'SESSION-RECONNECT' : { ok: true };
          socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result } }));
        }
      } catch { /* ignore */ }
    });
  });
  return { server };
}

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

describe('StpWebSocketsConnector reconnect behavior', () => {
  it('reconnects automatically after client socket closes while server remains up', async () => {
    let sock: any;
    let { server } = createServer(WS_URL1, (s) => { sock = s; });

    const connector = new StpWebSocketsConnector(WS_URL1);
    const sessionId = await connector.connect('ServiceName', ['Foo']);
    expect(sessionId).toBe('SESSION-RECONNECT');
    expect(connector.isConnected).toBe(true);

    // Close the client socket to trigger reconnect while server remains listening
    await new Promise((r) => setTimeout(r, 10));
    sock?.close();

    // Give reconnect some time
    const reconnected = await waitFor(() => connector.isConnected, 800);
    expect(reconnected).toBe(true);

    server.stop();
  });

  it('emits error if cannot reconnect after outage', async () => {
    const { server } = createServer(WS_URL2);
    const connector = new StpWebSocketsConnector(WS_URL2);
    const messages: string[] = [];
    connector.onError = (m) => messages.push(m);

    await connector.connect('ServiceX', ['Bar']);
    expect(connector.isConnected).toBe(true);

    // Close server and do not restart
    server.close();
    await new Promise((r) => setTimeout(r, 60));

    // Should have produced a user-readable error
    expect(messages.some((m) => m.includes('Lost connection to STP'))).toBe(true);
  });

  it('pending request during disconnect rejects on timeout', async () => {
    // Create a server that responds to Register but ignores Zeta requests
    const { Server } = await import('mock-socket');
    const server = new Server(WS_URL3);
    server.on('connection', (socket) => {
      socket.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data);
          if (msg.method === 'Request') {
            const cookie = msg.params.cookie;
            const inner = JSON.parse(msg.params.jsonRequest);
            if (inner.method === 'Register') {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'SESSION-TIMEOUT' } }));
            }
            // Intentionally ignore Zeta
          }
        } catch { /* ignore */ }
      });
    });
    const connector = new StpWebSocketsConnector(WS_URL3);
    await connector.connect('ServiceY', ['Zeta']);
    const p = connector.request('{"method":"Zeta"}', 0.05);
    // Close server to ensure no subsequent responses arrive
    server.close();
    await expect(p).rejects.toThrow(/Operation timed out/);
  });

  it('handles multiple reconnect cycles cleanly', async () => {
    let sock: any;
    let { server } = createServer(WS_URL1, (s) => { sock = s; });
    const connector = new StpWebSocketsConnector(WS_URL1);
    await connector.connect('ServiceName', ['Foo']);
    expect(connector.isConnected).toBe(true);

    // Close and wait for reconnect three times
    for (let i = 0; i < 3; i++) {
      sock?.close();
      const reconnected = await waitFor(() => connector.isConnected, 800);
      expect(reconnected).toBe(true);
      // Update to latest socket reference
      await new Promise((r) => setTimeout(r, 10));
    }
    server.stop();
  });
});
