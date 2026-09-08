import { describe, it, expect } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';

declare const global: any;
global.WebSocket = MockWebSocket as unknown as WebSocket;

const WS_URL = 'ws://localhost:24345';

describe('StpWebSocketsConnector.updateSolvables', () => {
  it('re-sends a Register message with the updated solvables list and updates sessionId', async () => {
    const registerPayloads: any[] = [];
    const server = new Server(WS_URL);
    server.on('connection', (socket) => {
      socket.on('message', (data: string) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Request') {
          const cookie = msg.params.cookie;
          const inner = JSON.parse(msg.params.jsonRequest);
          if (inner.method === 'Register') {
            registerPayloads.push(inner.params);
            const sessionId = registerPayloads.length === 1 ? 'SESSION-INITIAL' : 'SESSION-REFRESHED';
            socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: sessionId } }));
          }
        }
      });
    });

    const connector = new StpWebSocketsConnector(WS_URL);
    const initialSessionId = await connector.connect('Svc', ['Foo']);
    expect(initialSessionId).toBe('SESSION-INITIAL');
    expect(registerPayloads.length).toBe(1);
    expect(registerPayloads[0].solvables).toEqual(['Foo']);

    const refreshedSessionId = await connector.updateSolvables(['Foo', 'CoaSwitched']);

    expect(refreshedSessionId).toBe('SESSION-REFRESHED');
    expect(connector.sessionId).toBe('SESSION-REFRESHED');
    expect(registerPayloads.length).toBe(2);
    expect(registerPayloads[1].solvables).toEqual(['Foo', 'CoaSwitched']);

    server.stop();
  });

  it('throws a clear Error when called before a connection exists', async () => {
    const connector = new StpWebSocketsConnector(WS_URL);
    await expect(connector.updateSolvables(['Foo'])).rejects.toThrow(/not open/i);
  });
});
