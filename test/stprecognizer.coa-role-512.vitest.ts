import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

/**
 * STP-1800. The 5.12 API (contract 0.9.11) as the SDK sends it: UpdateCoa, and the engineer
 * role, which the engine names ENGINEER - ENG stays an alias (STP-1159) and the engine
 * confirms either with RoleSwitched 'engineer'.
 */

const CONTRACT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'json-api', 'sketch-thru-plan-api.json'), 'utf8'),
);
const method = (name: string) => CONTRACT.methods.find((m: { name: string }) => m.name === name);

// Connector double that records the last inform/request message sent - same pattern as the
// other command test files.
class SpyConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;

  lastRequestMessage: string | undefined;
  lastInformMessage: string | undefined;
  response: any = null;

  async connect(serviceName: string): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return 'STP-1800-SESSION';
  }
  async disconnect(): Promise<void> { this.isConnected = false; }
  async inform(message: string): Promise<void> {
    this.lastInformMessage = message;
  }
  async request(message: string): Promise<any> {
    this.lastRequestMessage = message;
    return this.response;
  }
}

async function connected(): Promise<{ connector: SpyConnector; recognizer: StpRecognizer }> {
  const connector = new SpyConnector();
  const recognizer = new StpRecognizer(connector);
  await recognizer.connect('Svc', 1);
  return { connector, recognizer };
}

describe('updateCoa (STP-1800)', () => {
  it('informs UpdateCoa with poid and coa, the params the contract declares, in order', async () => {
    const { connector, recognizer } = await connected();
    const coa = new StpType.StpCoa();
    coa.fsTYPE = 'coa';
    coa.poid = 'C1';
    coa.name = 'COA 1 (revised)';
    coa.affiliation = 'friend';

    recognizer.updateCoa('C1', coa);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('UpdateCoa');
    expect(msg.params).toEqual({
      poid: 'C1',
      coa: { fsTYPE: 'coa', poid: 'C1', name: 'COA 1 (revised)', affiliation: 'friend' },
    });
    const declared = method('UpdateCoa').params.map((p: { name: string }) => p.name);
    expect(Object.keys(msg.params)).toEqual(declared);
  });

  it('is an inform: it sends no request and returns nothing to await', async () => {
    const { connector, recognizer } = await connected();
    const result = recognizer.updateCoa('C1', new StpType.StpCoa());
    expect(result).toBeUndefined();
    expect(connector.lastRequestMessage).toBeUndefined();
    expect(method('UpdateCoa')['x-stpInform']).toBe(true);
  });

  it('the engine confirmation, CoaModified, reaches onCoaModified', async () => {
    const { connector, recognizer } = await connected();
    let received: { poid?: string; coa?: StpType.StpCoa } = {};
    recognizer.onCoaModified = (poid: string, coa: StpType.StpCoa) => { received = { poid, coa }; };
    connector.onInform?.(JSON.stringify({
      method: 'CoaModified', params: { poid: 'C1', coa: { poid: 'C1', name: 'COA 1 (revised)' }, isUndo: false },
    }));
    expect(received.poid).toBe('C1');
    expect(received.coa?.name).toBe('COA 1 (revised)');
  });
});

describe('ENGINEER role (STP-1159, STP-1800)', () => {
  it('StpRole.engineer is ENGINEER, and ENG is kept as the deprecated alias', () => {
    expect(StpType.StpRole.engineer).toBe('ENGINEER');
    expect(StpType.StpRole.eng).toBe('ENG');
  });

  it('every StpRole value is one the contract enumerates, ENGINEER and ENG included', () => {
    const contractRoles: string[] = CONTRACT.components.schemas.StpRole.enum;
    expect(contractRoles).toContain('ENGINEER');
    expect(contractRoles).toContain('ENG');
    const missing = Object.values(StpType.StpRole).filter((r) => !contractRoles.includes(r));
    expect(missing).toEqual([]);
  });

  it('setCurrentRole(StpRole.engineer) requests SetRole with role ENGINEER', async () => {
    const { connector, recognizer } = await connected();
    await recognizer.setCurrentRole(StpType.StpRole.engineer);
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('SetRole');
    expect(msg.params).toEqual({ role: 'ENGINEER' });
  });

  it('the ENG alias still goes out as sent - the engine maps it to engineer', async () => {
    const { connector, recognizer } = await connected();
    await recognizer.setCurrentRole(StpType.StpRole.eng);
    expect(JSON.parse(connector.lastRequestMessage!).params).toEqual({ role: 'ENG' });
  });

  it('RoleSwitched engineer, the engine confirmation for either spelling, reaches onRoleSwitched', async () => {
    const { connector, recognizer } = await connected();
    let role: string | undefined;
    recognizer.onRoleSwitched = (r) => { role = r as unknown as string; };
    connector.onInform?.(JSON.stringify({ method: 'RoleSwitched', params: { role: 'engineer' } }));
    expect(role).toBe('engineer');
    expect(role!.toUpperCase()).toBe(StpType.StpRole.engineer);
  });
});
