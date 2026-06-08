import { describe, it, expect } from 'vitest';
import { WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';

// Mock global WebSocket
declare const global: any;
global.WebSocket = MockWebSocket as unknown as WebSocket;

const INVALID_WS_URL = 'ws://localhost:56789'; // no server bound
const WS_URL_INVALID_PAYLOAD = 'ws://localhost:22347';
const WS_URL_AFTER_CLOSE = 'ws://localhost:22348';
const WS_URL_REGISTER_FAIL = 'ws://localhost:22350';
const WS_URL_REQUEST_TIMEOUT = 'ws://localhost:22351';

describe('StpWebSocketsConnector failures (mocked)', () => {
  it('throws error when connecting to unserved websocket endpoint (timeout)', async () => {
    const connector = new StpWebSocketsConnector(INVALID_WS_URL);
    await expect(connector.connect('ServiceName', [], 0.02)).rejects.toThrow(/Failed to connect:/);
    expect(connector.isConnected).toBe(false);
  });

  it('shows isConnected as false if not connected', async () => {
    const connector = new StpWebSocketsConnector(INVALID_WS_URL);
    await expect(connector.connect('ServiceName', [], 0.02)).rejects.toBeDefined();
    expect(connector.isConnected).toBe(false);
  });

  it('throws when informing while disconnected', async () => {
    const connector = new StpWebSocketsConnector(INVALID_WS_URL);
    await expect(connector.connect('ServiceName', [], 0.02)).rejects.toBeDefined();
    expect(() => connector.inform('{"method":"Foo"}')).toThrow(/Failed to send inform: connection is not open/);
  });

  it('throws when requesting while disconnected', async () => {
    const connector = new StpWebSocketsConnector(INVALID_WS_URL);
    await expect(connector.connect('ServiceName', [], 0.02)).rejects.toBeDefined();
    await expect(connector.request('{"method":"Foo"}')).rejects.toThrow(/Failed to send request: connection is not open/);
  });

  // Note: invalid non-JSON payloads will throw in connector (by design); skipping that scenario

  it('inform/request after onclose reject consistently', async () => {
    const { Server } = await import('mock-socket');
    const server = new Server(WS_URL_AFTER_CLOSE);
    server.on('connection', (socket) => {
      socket.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data);
          if (msg.method === 'Request') {
            const cookie = msg.params.cookie;
            const inner = JSON.parse(msg.params.jsonRequest);
            if (inner.method === 'Register') {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'SESSION-CLOSE' } }));
            }
          }
        } catch { /* ignore */ }
      });
    });
    const connector = new StpWebSocketsConnector(WS_URL_AFTER_CLOSE);
    await connector.connect('ServiceName', []);
    expect(connector.isConnected).toBe(true);
    // Close server and wait
    server.close();
    await new Promise((r) => setTimeout(r, 20));
    expect(() => connector.inform('{"method":"Foo"}')).toThrow(/Failed to send inform: connection is not open/);
    await expect(connector.request('{"method":"Foo"}')).rejects.toThrow(/Failed to send request: connection is not open/);
  });

  it('connect rejects when registration fails (success=false)', async () => {
    const { Server } = await import('mock-socket');
    const server = new Server(WS_URL_REGISTER_FAIL);
    server.on('connection', (socket) => {
      socket.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data);
          if (msg.method === 'Request') {
            const cookie = msg.params.cookie;
            const inner = JSON.parse(msg.params.jsonRequest);
            if (inner.method === 'Register') {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: false, result: { message: 'REG-ERR' } } }));
            }
          }
        } catch { /* ignore */ }
      });
    });
    const connector = new StpWebSocketsConnector(WS_URL_REGISTER_FAIL);
    await expect(connector.connect('ServiceName', ['Foo'])).rejects.toThrow(/Failed to register with STP: REG-ERR/);
    server.stop();
  });

  it('request rejects on timeout when no response is received', async () => {
    const { Server } = await import('mock-socket');
    const server = new Server(WS_URL_REQUEST_TIMEOUT);
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
            // Intentionally do not reply to non-register requests
          }
        } catch { /* ignore */ }
      });
    });

    const connector = new StpWebSocketsConnector(WS_URL_REQUEST_TIMEOUT);
    await connector.connect('ServiceName', ['Foo']);
    await expect(connector.request('{"method":"NoReply"}', 0.01)).rejects.toThrow(/Operation timed out/);
    server.stop();
  });

  it('inform rejects when socket becomes unavailable despite connected state', async () => {
    const connector = new StpWebSocketsConnector(INVALID_WS_URL);

    Object.defineProperty(connector, 'isConnected', {
      configurable: true,
      get: () => true
    });

    connector.socket = null as any;
    await expect(connector.inform('{"method":"Foo"}')).rejects.toThrow(
      /socket is not available/
    );
  });
});
