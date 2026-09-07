import { describe, it, expect } from 'vitest';
import { WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';

declare const global: any;
global.WebSocket = MockWebSocket as unknown as WebSocket;

const WS_REFUSAL_NULL = 'ws://localhost:22371';
const WS_REFUSAL_REASON = 'ws://localhost:22372';

/**
 * A refused request must reject with something a developer can read.
 *
 * STP answers a method it cannot dispatch with `RequestResponse { success: false, result: null }`.
 * The connector rejected with that raw result, so callers got a rejection whose reason was `null`:
 * no Error, no message, no stack. That is how a family of methods this SDK sends but the engine
 * never dispatches (the COA calls) stayed invisible. Engines from 2026-09 put the reason in the
 * result and that text must survive.
 */
function serverThatRefuses(url: string, result: unknown) {
  return import('mock-socket').then(({ Server }) => {
    const server = new Server(url);
    server.on('connection', (socket: any) => {
      socket.on('message', (data: any) => {
        try {
          const msg = JSON.parse(data);
          if (msg.method === 'Request') {
            const cookie = msg.params.cookie;
            const inner = JSON.parse(msg.params.jsonRequest);
            if (inner.method === 'Register') {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'session-1' } }));
            } else {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: false, result } }));
            }
          }
        } catch { /* ignore */ }
      });
    });
    return server;
  });
}

describe('refused requests are legible', () => {
  it('rejects with an Error, not a bare null, when the engine gives no reason', async () => {
    const server = await serverThatRefuses(WS_REFUSAL_NULL, null);
    const connector = new StpWebSocketsConnector(WS_REFUSAL_NULL);
    await connector.connect('ServiceName', []);

    const rejection = await connector.request('{"method":"AddCoa","params":{}}').then(
      () => { throw new Error('the request should not have resolved'); },
      (e) => e
    );

    expect(rejection).toBeInstanceOf(Error);
    expect(String((rejection as Error).message)).not.toBe('');
    expect(String((rejection as Error).message)).toMatch(/refus|no reason|handler/i);
    server.stop();
  });

  it('keeps the engine text when the engine names the method', async () => {
    const reason = "No handler for method 'AddCoa' - the WebSocketsBridge does not dispatch it";
    const server = await serverThatRefuses(WS_REFUSAL_REASON, reason);
    const connector = new StpWebSocketsConnector(WS_REFUSAL_REASON);
    await connector.connect('ServiceName', []);

    const rejection = await connector.request('{"method":"AddCoa","params":{}}').then(
      () => { throw new Error('the request should not have resolved'); },
      (e) => e
    );

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toContain('AddCoa');
    expect((rejection as Error).message).toContain('No handler');
    server.stop();
  });
});
