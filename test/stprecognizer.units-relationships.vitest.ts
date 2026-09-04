import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

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
    return 'UNITS-REL';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(): Promise<void> {}
  async request(): Promise<any> { return { ok: true }; }
}

describe('StpRecognizer unit and relationship dispatch', () => {
  it('TaskOrgUnitAdded yields StpTaskOrgUnit', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let unit: StpType.StpTaskOrgUnit | undefined;
    recognizer.onTaskOrgUnitAdded = (u) => { unit = u; };
    await recognizer.connect('Svc', 1);
    const unitProps: any = { poid: 'U1', name: 'Unit 1' };
    connector.onInform?.(JSON.stringify({ method: 'TaskOrgUnitAdded', params: { poid: 'TO1', toUnit: unitProps, isUndo: false } }));
    expect(unit).toBeInstanceOf(StpType.StpTaskOrgUnit);
    expect(unit?.poid).toBe('U1');
  });

  it('TaskOrgUnitModified provides poid and StpTaskOrgUnit', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let seen: { poid?: string; unit?: StpType.StpTaskOrgUnit; isUndo?: boolean } = {};
    recognizer.onTaskOrgUnitModified = (poid, u, isUndo) => { seen = { poid, unit: u, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'TaskOrgUnitModified', params: { poid: 'TO1', toUnit: { poid: 'U2', name: 'Unit 2' }, isUndo: false } }));
    expect(seen.poid).toBe('TO1');
    expect(seen.unit).toBeInstanceOf(StpType.StpTaskOrgUnit);
  });

  it('TaskOrgUnitDeleted calls handler with poid/isUndo', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; isUndo?: boolean } = {};
    recognizer.onTaskOrgUnitDeleted = (poid, isUndo) => { payload = { poid, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'TaskOrgUnitDeleted', params: { poid: 'U3', isUndo: true } }));
    expect(payload.poid).toBe('U3');
    expect(payload.isUndo).toBe(true);
  });

  it('TaskOrgRelationshipAdded yields StpTaskOrgRelationship', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let rel: StpType.StpTaskOrgRelationship | undefined;
    recognizer.onTaskOrgRelationshipAdded = (r) => { rel = r; };
    await recognizer.connect('Svc', 1);
    const relProps: any = { poid: 'R1', relation: 'supports' };
    connector.onInform?.(JSON.stringify({ method: 'TaskOrgRelationshipAdded', params: { poid: 'TO1', toRelationship: relProps, isUndo: false } }));
    expect(rel).toBeInstanceOf(StpType.StpTaskOrgRelationship);
    expect(rel?.poid).toBe('R1');
  });

  it('TaskOrgRelationshipModified provides poid and StpTaskOrgRelationship', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let seen: { poid?: string; rel?: StpType.StpTaskOrgRelationship; isUndo?: boolean } = {};
    recognizer.onTaskOrgRelationshipModified = (poid, r, isUndo) => { seen = { poid, rel: r, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'TaskOrgRelationshipModified', params: { poid: 'TO1', toRelationship: { poid: 'R2', relation: 'supports' }, isUndo: false } }));
    expect(seen.poid).toBe('TO1');
    expect(seen.rel).toBeInstanceOf(StpType.StpTaskOrgRelationship);
  });

  it('TaskOrgRelationshipDeleted calls handler with poid/isUndo', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let payload: { poid?: string; isUndo?: boolean } = {};
    recognizer.onTaskOrgRelationshipDeleted = (poid, isUndo) => { payload = { poid, isUndo }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'TaskOrgRelationshipDeleted', params: { poid: 'R3', isUndo: false } }));
    expect(payload.poid).toBe('R3');
    expect(payload.isUndo).toBe(false);
  });

  it('TaskOrgSwitched delivers StpTaskOrg', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let to: StpType.StpTaskOrg | undefined;
    recognizer.onTaskOrgSwitched = (t) => { to = t; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'TaskOrgSwitched', params: { taskOrg: { poid: 'TOX', name: 'OrgX' } } }));
    expect(to?.poid).toBe('TOX');
  });

  it('SymbolEdited and Command deliver operation and location', async () => {
    const connector = new MockConnector();
    const recognizer = new StpRecognizer(connector);
    let edit: { op?: string; loc?: StpType.Location } = {};
    let cmd: { op?: string; loc?: StpType.Location } = {};
    recognizer.onSymbolEdited = (op, loc) => { edit = { op, loc }; };
    recognizer.onCommand = (op, loc) => { cmd = { op, loc }; };
    await recognizer.connect('Svc', 1);
    connector.onInform?.(JSON.stringify({ method: 'SymbolEdited', params: { operation: 'move', location: { lat: 2.34, lon: 5.67 } } }));
    connector.onInform?.(JSON.stringify({ method: 'Command', params: { operation: 'zoom', location: { lat: 3.21, lon: 6.54 } } }));
    expect(edit.op).toBe('move');
    expect(edit.loc?.lat).toBe(2.34);
    expect(cmd.op).toBe('zoom');
    expect(cmd.loc?.lon).toBe(6.54);
  });
});
