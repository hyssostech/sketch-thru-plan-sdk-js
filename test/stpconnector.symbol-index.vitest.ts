import { describe, it, expect } from 'vitest';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { StpWebSocketsConnector } from '../src/stpconnector.ts';
import { SymbolSearch } from '../src/symbolsearch.ts';

// Mock global WebSocket
declare const global: any;
global.WebSocket = MockWebSocket as unknown as WebSocket;

const WS_URL = 'ws://localhost:22361';

/** STP-1383: a connected connector tells SymbolSearch.load() where its STP serves the symbol index. */
describe('StpWebSocketsConnector symbol index URL (STP-1383)', () => {
  it('derives the index URL from the connection string, session suffix dropped', () => {
    expect(new StpWebSocketsConnector('ws://stp.local:9599/my-session').symbolIndexUrl).toBe(
      'http://stp.local:9599/symbol-index.json'
    );
    expect(new StpWebSocketsConnector('wss://stp.local:19599').symbolIndexUrl).toBe(
      'https://stp.local:19599/symbol-index.json'
    );
  });

  it('a successful connect makes its bridge the default for SymbolSearch.load()', async () => {
    SymbolSearch.connectedIndexUrl = undefined;
    const server = new Server(WS_URL);
    server.on('connection', (socket) => {
      socket.on('message', (data: string) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Request') {
          const inner = JSON.parse(msg.params.jsonRequest);
          if (inner.method === 'Register')
            socket.send(
              JSON.stringify({
                method: 'RequestResponse',
                params: { cookie: msg.params.cookie, success: true, result: 'SESSION' }
              })
            );
        }
      });
    });
    try {
      const connector = new StpWebSocketsConnector(WS_URL);
      await connector.connect('ServiceName', []);
      expect(SymbolSearch.connectedIndexUrl).toBe('http://localhost:22361/symbol-index.json');
      void connector.disconnect().catch(() => undefined);
    } finally {
      server.close();
      SymbolSearch.connectedIndexUrl = undefined;
    }
  });

  it('a failed connect leaves the default untouched', async () => {
    SymbolSearch.connectedIndexUrl = undefined;
    const connector = new StpWebSocketsConnector('ws://localhost:56790');
    await expect(connector.connect('ServiceName', [], 0.02)).rejects.toBeDefined();
    expect(SymbolSearch.connectedIndexUrl).toBeUndefined();
  });
});
