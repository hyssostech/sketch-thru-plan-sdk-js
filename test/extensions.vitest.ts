import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

// Spy connector that captures outbound messages
class SpyConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  lastInformMessage: string | undefined;

  async connect(serviceName: string): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return 'EXT-SESSION';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(message: string): Promise<void> {
    this.lastInformMessage = message;
  }
  async request(): Promise<any> { return { ok: true }; }
}

// Mock connector for inbound event tests
class MockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  async connect(serviceName: string): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return 'EXT-SESSION';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

const sampleExtensions = {
  appId: 'testClient',
  priority: 5,
  visible: true,
};

const nestedExtensions = {
  appId: 'testClient',
  metadata: {
    color: '#FF0000',
    layers: ['layer1', 'layer2'],
    config: { enabled: true, level: 3 },
  },
  tags: ['urgent', 'reviewed'],
};

describe('Extensions type declarations', () => {
  it('StpSymbol has optional extensions property', () => {
    const sym = new StpType.StpSymbol();
    expect(sym.extensions).toBeUndefined();
    sym.extensions = { appId: 'test' };
    expect(sym.extensions.appId).toBe('test');
  });

  it('StpTask has optional extensions property (inherited from StpItem)', () => {
    const task = new StpType.StpTask();
    expect(task.extensions).toBeUndefined();
    task.extensions = { priority: 1 };
    expect(task.extensions.priority).toBe(1);
  });

  it('StpTaskOrg has optional extensions property', () => {
    const to = new StpType.StpTaskOrg();
    expect(to.extensions).toBeUndefined();
    to.extensions = { custom: 'value' };
    expect(to.extensions.custom).toBe('value');
  });

  it('StpTaskOrgUnit inherits extensions from StpSymbol/StpItem', () => {
    const unit = new StpType.StpTaskOrgUnit();
    expect(unit.extensions).toBeUndefined();
    unit.extensions = { unitProp: 42 };
    expect(unit.extensions.unitProp).toBe(42);
  });

  it('StpTaskOrgRelationship has optional extensions property', () => {
    const rel = new StpType.StpTaskOrgRelationship();
    expect(rel.extensions).toBeUndefined();
    rel.extensions = { relProp: true };
    expect(rel.extensions.relProp).toBe(true);
  });

  it('extensions supports nested complex structures', () => {
    const sym = new StpType.StpSymbol();
    sym.extensions = nestedExtensions;
    expect((sym.extensions.metadata as any).color).toBe('#FF0000');
    expect((sym.extensions.metadata as any).layers).toEqual(['layer1', 'layer2']);
    expect((sym.extensions.tags as any)).toEqual(['urgent', 'reviewed']);
  });
});

describe('Extensions inbound (server → client) via events', () => {
  it('SymbolAdded carries extensions through Object.assign', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: StpType.StpSymbol[] = [];
    recognizer.onSymbolAdded = (alts) => { received = alts; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({
      method: 'SymbolAdded',
      params: {
        alternates: [{
          poid: 'P1',
          fsTYPE: 'unit',
          affiliation: 'friend',
          extensions: sampleExtensions
        }],
        isUndo: false
      }
    }));

    expect(received.length).toBe(1);
    expect(received[0]).toBeInstanceOf(StpType.StpSymbol);
    expect(received[0].extensions).toBeDefined();
    expect(received[0].extensions?.appId).toBe('testClient');
    expect(received[0].extensions?.priority).toBe(5);
    expect(received[0].extensions?.visible).toBe(true);
  });

  it('SymbolAdded without extensions leaves property undefined', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: StpType.StpSymbol[] = [];
    recognizer.onSymbolAdded = (alts) => { received = alts; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({
      method: 'SymbolAdded',
      params: {
        alternates: [{ poid: 'P2', fsTYPE: 'unit' }],
        isUndo: false
      }
    }));

    expect(received.length).toBe(1);
    expect(received[0].extensions).toBeUndefined();
  });

  it('SymbolModified carries extensions', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let sym: StpType.StpSymbol | undefined;
    recognizer.onSymbolModified = (_poid, s) => { sym = s; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({
      method: 'SymbolModified',
      params: {
        poid: 'P1',
        symbol: { poid: 'P1', fsTYPE: 'unit', extensions: { color: '#00FF00' } },
        isUndo: false
      }
    }));

    expect(sym).toBeInstanceOf(StpType.StpSymbol);
    expect(sym?.extensions?.color).toBe('#00FF00');
  });

  it('SymbolAdded carries nested extensions', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let received: StpType.StpSymbol[] = [];
    recognizer.onSymbolAdded = (alts) => { received = alts; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({
      method: 'SymbolAdded',
      params: {
        alternates: [{
          poid: 'P3',
          fsTYPE: 'unit',
          extensions: nestedExtensions
        }],
        isUndo: false
      }
    }));

    expect(received[0].extensions).toBeDefined();
    const meta = received[0].extensions?.metadata as any;
    expect(meta.color).toBe('#FF0000');
    expect(meta.layers).toEqual(['layer1', 'layer2']);
    expect(meta.config.enabled).toBe(true);
  });

  it('TaskAdded carries extensions', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let tasks: StpType.StpTask[] = [];
    recognizer.onTaskAdded = (_poid, alts) => { tasks = alts; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({
      method: 'TaskAdded',
      params: {
        poid: 'T1',
        alternates: [{
          poid: 'T1',
          fsTYPE: 'task',
          name: 'Attack',
          extensions: { severity: 'high' }
        }],
        taskPoids: ['T1'],
        isUndo: false
      }
    }));

    expect(tasks.length).toBe(1);
    expect(tasks[0]).toBeInstanceOf(StpType.StpTask);
    expect(tasks[0].extensions?.severity).toBe('high');
  });

  it('TaskOrgAdded carries extensions', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let taskOrg: StpType.StpTaskOrg | undefined;
    recognizer.onTaskOrgAdded = (to) => { taskOrg = to; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({
      method: 'TaskOrgAdded',
      params: {
        poid: 'TO1',
        taskOrg: { poid: 'TO1', fsTYPE: 'task_org', name: '3-3', extensions: { source: 'import' } },
        isUndo: false
      }
    }));

    expect(taskOrg).toBeInstanceOf(StpType.StpTaskOrg);
    expect(taskOrg?.extensions?.source).toBe('import');
  });

  it('TaskOrgUnitAdded carries extensions', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let unit: StpType.StpTaskOrgUnit | undefined;
    recognizer.onTaskOrgUnitAdded = (u) => { unit = u; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({
      method: 'TaskOrgUnitAdded',
      params: {
        poid: 'TOU1',
        toUnit: { poid: 'TOU1', fsTYPE: 'task_org_unit', extensions: { rank: 1 } },
        isUndo: false
      }
    }));

    expect(unit).toBeInstanceOf(StpType.StpTaskOrgUnit);
    expect(unit?.extensions?.rank).toBe(1);
  });

  it('TaskOrgRelationshipAdded carries extensions', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let rel: StpType.StpTaskOrgRelationship | undefined;
    recognizer.onTaskOrgRelationshipAdded = (r) => { rel = r; };

    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({
      method: 'TaskOrgRelationshipAdded',
      params: {
        poid: 'TOR1',
        toRelationship: { poid: 'TOR1', fsTYPE: 'task_org_relationship', extensions: { custom: true } },
        isUndo: false
      }
    }));

    expect(rel).toBeInstanceOf(StpType.StpTaskOrgRelationship);
    expect(rel?.extensions?.custom).toBe(true);
  });
});

describe('Extensions outbound (client → server) via commands', () => {
  it('addSymbol sends extensions in the JSON payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const sym = new StpType.StpSymbol();
    sym.poid = 'P1';
    sym.fsTYPE = 'unit';
    sym.extensions = sampleExtensions;

    recognizer.addSymbol(sym);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('AddSymbol');
    expect(msg.params.symbol.extensions).toEqual(sampleExtensions);
  });

  it('updateSymbol sends extensions in the JSON payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const sym = new StpType.StpSymbol();
    sym.poid = 'P1';
    sym.fsTYPE = 'unit';
    sym.extensions = { modified: true };

    recognizer.updateSymbol('P1', sym);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('UpdateSymbol');
    expect(msg.params.symbol.extensions).toEqual({ modified: true });
  });

  it('addSymbol without extensions omits it from payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const sym = new StpType.StpSymbol();
    sym.poid = 'P1';
    sym.fsTYPE = 'unit';

    recognizer.addSymbol(sym);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.params.symbol.extensions).toBeUndefined();
  });

  it('addSymbol sends nested extensions correctly', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const sym = new StpType.StpSymbol();
    sym.poid = 'P1';
    sym.extensions = nestedExtensions;

    recognizer.addSymbol(sym);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.params.symbol.extensions.metadata.color).toBe('#FF0000');
    expect(msg.params.symbol.extensions.tags).toEqual(['urgent', 'reviewed']);
  });
});
