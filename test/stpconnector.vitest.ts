import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';

// Mock global WebSocket for connector
declare const global: any;
global.WebSocket = MockWebSocket as unknown as WebSocket;

const WS_URL = 'ws://localhost:12345';

let server: Server;

beforeAll(() => {
  // Create a mock WebSocket server
  server = new Server(WS_URL);

  server.on('connection', (socket) => {
    socket.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data);
        // Expect Request meta-message
        if (msg && msg.method === 'Request') {
          const cookie = msg.params?.cookie;
          const payload = msg.params?.jsonRequest;
          // Parse inner JSON if present
          let inner;
          try { inner = JSON.parse(payload); } catch {
            inner = { method: 'Unknown' };
          }
          // Respond with RequestResponse: register returns session; Fail returns error; others return ok
          if (inner.method === 'Register') {
            socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'SESSION123' } }));
          } else if (inner.method === 'Fail') {
            socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: false, result: 'BAD' } }));
          } else {
            socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: { ok: true } } }));
          }
        }
      } catch {
        // ignore parse errors in test
      }
    });
  });
});

afterAll(() => {
  server.stop();
});

describe('StpWebSocketsConnector (mocked)', () => {
  it('connects and registers, returning session id', async () => {
    const connector = new StpWebSocketsConnector(WS_URL);
    const sessionId = await connector.connect('ServiceName', ['Foo']);
    expect(sessionId).toBe('SESSION123');
    expect(connector.isConnected).toBe(true);
  });

  it('inform succeeds while connected', async () => {
    const connector = new StpWebSocketsConnector(WS_URL);
    await connector.connect('ServiceName', ['Foo']);
    await expect(connector.inform('{"method":"Foo"}')).resolves.toBeUndefined();
  });

  it('request returns a value from server', async () => {
    const connector = new StpWebSocketsConnector(WS_URL);
    await connector.connect('ServiceName', ['Foo']);
    const result = await connector.request('{"method":"Bar"}');
    expect(result).toEqual({ ok: true });
  });

  it('request rejects when server responds with success=false', async () => {
    const connector = new StpWebSocketsConnector(WS_URL);
    await connector.connect('ServiceName', ['Foo']);
    await expect(connector.request('{"method":"Fail"}')).rejects.toBe('BAD');
  });

  it('onerror dispatch triggers user-readable error message', async () => {
    const connector = new StpWebSocketsConnector(WS_URL);
    const messages: string[] = [];
    connector.onError = (m) => messages.push(m);
    await connector.connect('ServiceName', ['Foo']);
    // Simulate an error from the socket after connection
    connector.socket?.onerror?.({} as any);
    expect(messages.some((m) => m.includes('Error connecting to STP'))).toBe(true);
  });
});
