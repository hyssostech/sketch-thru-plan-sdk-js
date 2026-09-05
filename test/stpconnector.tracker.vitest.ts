import { describe, it, expect } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';

declare const global: any;
global.WebSocket = MockWebSocket as unknown as WebSocket;

const WS_URL = 'ws://localhost:23345';

describe('StpWebSocketsConnector tracker concurrency', () => {
  it('resolves concurrent requests based on cookie correlation (out-of-order responses)', async () => {
    const server = new Server(WS_URL);
    server.on('connection', (socket) => {
      socket.on('message', (data: string) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Request') {
          const cookie = msg.params.cookie;
          const inner = JSON.parse(msg.params.jsonRequest);
          if (inner.method === 'Register') {
            socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'SESSION-TRACK' } }));
          } else if (inner.method === 'Alpha') {
            // Respond later (out-of-order)
            setTimeout(() => {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'R1' } }));
            }, 40);
          } else if (inner.method === 'Beta') {
            // Respond earlier
            setTimeout(() => {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'R2' } }));
            }, 10);
          }
        }
      });
    });

    const connector = new StpWebSocketsConnector(WS_URL);
    await connector.connect('Svc', ['Alpha', 'Beta']);

    const p1 = connector.request('{"method":"Alpha"}');
    const p2 = connector.request('{"method":"Beta"}');

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('R1');
    expect(r2).toBe('R2');

    server.stop();
  });

  it('ignores responses with unknown cookie and still resolves real request', async () => {
    const server = new Server(WS_URL);
    server.on('connection', (socket) => {
      socket.on('message', (data: string) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Request') {
          const cookie = msg.params.cookie;
          const inner = JSON.parse(msg.params.jsonRequest);
          if (inner.method === 'Register') {
            socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'SESSION-TRACK' } }));
          } else if (inner.method === 'Gamma') {
            // First send an unrelated cookie response
            socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie: -999, success: true, result: 'IGNORED' } }));
            setTimeout(() => {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'REAL' } }));
            }, 15);
          }
        }
      });
    });

    const connector = new StpWebSocketsConnector(WS_URL);
    await connector.connect('Svc', ['Gamma']);
    const res = await connector.request('{"method":"Gamma"}');
    expect(res).toBe('REAL');
    server.stop();
  });

  it('duplicate responses for same cookie resolve once and second is ignored', async () => {
    const server = new Server(WS_URL);
    server.on('connection', (socket) => {
      socket.on('message', (data: string) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Request') {
          const cookie = msg.params.cookie;
          const inner = JSON.parse(msg.params.jsonRequest);
          if (inner.method === 'Register') {
            socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'SESSION-TRACK' } }));
          } else if (inner.method === 'Delta') {
            setTimeout(() => {
              socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'FIRST' } }));
              // Later send a second duplicate response which should be ignored
              setTimeout(() => {
                socket.send(JSON.stringify({ method: 'RequestResponse', params: { cookie, success: true, result: 'SECOND' } }));
              }, 15);
            }, 10);
          }
        }
      });
    });

    const connector = new StpWebSocketsConnector(WS_URL);
    await connector.connect('Svc', ['Delta']);
    const res = await connector.request('{"method":"Delta"}');
    expect(res).toBe('FIRST');
    server.stop();
  });
});
