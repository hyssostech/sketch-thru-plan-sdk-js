import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';

class SpyConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = false;
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;

  lastRequestMessage: string | undefined;
  lastInformMessage: string | undefined;
  response: any = 'OK';

  async connect(serviceName: string): Promise<string | undefined> {
    this.name = serviceName;
    this.isConnected = true;
    return 'CMD-SESSION';
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

describe('StpRecognizer command wrappers', () => {
  it('requestStp formats method and params into JSON', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    await recognizer.requestStp('CreateNewScenario', { name: 'Test' });
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('CreateNewScenario');
    expect(msg.params).toEqual({ name: 'Test' });
  });

  it('createNewScenario calls request with correct payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    await recognizer.createNewScenario('Alpha');
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('CreateNewScenario');
    expect(msg.params).toEqual({ name: 'Alpha' });
  });

  it('getScenarioContent requests with null params and returns string', async () => {
    const connector = new SpyConnector();
    connector.response = 'object_set([[x]])';
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getScenarioContent();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetScenarioContent');
    expect(msg.params).toBeNull();
    expect(result).toBe('object_set([[x]])');
  });

  it('hasActiveScenario returns boolean', async () => {
    const connector = new SpyConnector();
    connector.response = true;
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const hasActive = await recognizer.hasActiveScenario();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('HasActiveScenario');
    expect(msg.params).toBeNull();
    expect(hasActive).toBe(true);
  });

  it('syncScenarioSession includes content payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    await recognizer.syncScenarioSession('object_set([[y]])');
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('SyncScenarioSession');
    expect(msg.params).toEqual({ content: 'object_set([[y]])' });
  });

  it('joinScenarioSession requests with null params', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    await recognizer.joinScenarioSession();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('JoinScenarioSession');
    expect(msg.params).toBeNull();
  });

  it('importPlanData includes content payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    await recognizer.importPlanData('object_set([[z]])');
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('ImportPlanData');
    expect(msg.params).toEqual({ content: 'object_set([[z]])' });
  });

  it('addSymbol informs with correct payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const symbol: any = { poid: 'S1', name: 'Unit' };
    recognizer.addSymbol(symbol);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('AddSymbol');
    expect(msg.params).toEqual({ symbol });
  });

  it('updateSymbol informs with correct payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const symbol: any = { poid: 'S1', name: 'Unit' };
    recognizer.updateSymbol('S1', symbol);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('UpdateSymbol');
    expect(msg.params).toEqual({ poid: 'S1', symbol });
  });

  it('deleteSymbol informs with correct payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.deleteSymbol('S9');
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('DeleteSymbol');
    expect(msg.params).toEqual({ poid: 'S9' });
  });

  it('chooseAlternate informs with correct payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.chooseAlternate('S1', 2);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('ChooseAlternate');
    expect(msg.params).toEqual({ poid: 'S1', nBestIndex: 2 });
  });

  it('TaskOrg add/update/delete inform payloads', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const to: any = { poid: 'TO1', name: 'Org' };
    recognizer.addTaskOrg(to);
    let msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('AddTaskOrg');
    expect(msg.params).toEqual({ taskOrg: to });

    recognizer.updateTaskOrg('TO1', { poid: 'TO1', name: 'Org2' } as any);
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('UpdateTaskOrg');
    expect(msg.params).toEqual({ poid: 'TO1', taskOrg: { poid: 'TO1', name: 'Org2' } });

    recognizer.deleteTaskOrg('TO1');
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('DeleteTaskOrg');
    expect(msg.params).toEqual({ poid: 'TO1' });
  });

  it('Task add/update/delete inform payloads', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const task: any = { poid: 'T1', name: 'Task' };
    recognizer.addTask(task);
    let msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('AddTask');
    expect(msg.params).toEqual({ task });

    recognizer.updateTask('ROOT', [{ poid: 'T1', name: 'Task2' }] as any);
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('UpdateTask');
    expect(msg.params).toEqual({ poid: 'ROOT', alternates: [{ poid: 'T1', name: 'Task2' }] });

    recognizer.deleteTask('T1');
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('DeleteTask');
    expect(msg.params).toEqual({ poid: 'T1' });
  });

  it('Unit/Relationship add/update/delete inform payloads', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.addTaskOrgUnit({ poid: 'U1', name: 'Unit1' } as any);
    let msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('AddTaskOrgUnit');
    expect(msg.params).toEqual({ toUnit: { poid: 'U1', name: 'Unit1' } });

    recognizer.updateTaskOrgUnit('TO1', { poid: 'U2', name: 'Unit2' } as any);
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('UpdateTaskOrgUnit');
    expect(msg.params).toEqual({ poid: 'TO1', toUnit: { poid: 'U2', name: 'Unit2' } });

    recognizer.deleteTaskOrgUnit('U1');
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('DeleteTaskOrgUnit');
    expect(msg.params).toEqual({ poid: 'U1' });

    recognizer.addTaskOrgRelationship({ poid: 'R1', relation: 'supports' } as any);
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('AddTaskOrgRelationship');
    expect(msg.params).toEqual({ toRelationship: { poid: 'R1', relation: 'supports' } });

    recognizer.updateTaskOrgRelationship('TO1', { poid: 'R2', relation: 'supports' } as any);
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('UpdateTaskOrgRelationship');
    expect(msg.params).toEqual({ poid: 'TO1', toRelationship: { poid: 'R2', relation: 'supports' } });

    recognizer.deleteTaskOrgRelationship('R1');
    msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('DeleteTaskOrgRelationship');
    expect(msg.params).toEqual({ poid: 'R1' });
  });

  it('confirmTask informs with correct payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.confirmTask('T1', 0, true);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('ConfirmTask');
    expect(msg.params).toEqual({ poid: 'T1', nBestIndex: 0, isConfirmed: true });
  });

  it('requestStp with BigInt params reports error via onStpMessage', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);
    let reported: { msg?: string } = {};
    recognizer.onStpMessage = (m) => { reported = { msg: m }; };
    // BigInt is not serializable via JSON.stringify
    await recognizer.requestStp('CreateNewScenario', { count: (1n as any) });
    expect(reported.msg).toMatch(/BigInt/);
    // No request should have been sent
    expect(connector.lastRequestMessage).toBeUndefined();
  });

  it('informStp with BigInt params reports error via onStpMessage', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);
    let reported: { msg?: string } = {};
    recognizer.onStpMessage = (m) => { reported = { msg: m }; };
    recognizer.addSymbol({ poid: 'S1', count: (1n as any) } as any);
    expect(reported.msg).toMatch(/BigInt/);
    // No inform should have been sent
    expect(connector.lastInformMessage).toBeUndefined();
  });

  it('TaskOrg request wrappers format payloads correctly', async () => {
    const connector = new SpyConnector();
    connector.response = 'TO-NEW';
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    // importTaskOrgContent
    const newId = await recognizer.importTaskOrgContent('object_set([[to]])');
    let msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('ImportTaskOrgContent');
    expect(msg.params).toEqual({ content: 'object_set([[to]])' });
    expect(newId).toBe('TO-NEW');

    // getTaskOrgContent
    connector.response = 'object_set([[to2]])';
    const content = await recognizer.getTaskOrgContent('TO1');
    msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetTaskOrgContent');
    expect(msg.params).toEqual({ poid: 'TO1' });
    expect(content).toBe('object_set([[to2]])');

    // setDefaultTaskOrg
    await recognizer.setDefaultTaskOrg('TO1');
    msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('SetDefaultTaskOrg');
    expect(msg.params).toEqual({ poid: 'TO1' });

    // resetDefaultTaskOrg
    await recognizer.resetDefaultTaskOrg('friend');
    msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('ResetDefaultTaskOrg');
    expect(msg.params).toEqual({ affiliation: 'friend' });
  });

  it('COA request wrappers format payloads correctly', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    // setCoaTaskOrg
    await recognizer.setCoaTaskOrg('TO1', 'C1');
    let msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('SetCoaTaskOrg');
    expect(msg.params).toEqual({ toPoid: 'TO1', coaPoid: 'C1' });

    // resetCoaTaskOrg (current implementation sends affiliation=coaPoid and omits undefined coaPoid)
    await recognizer.resetCoaTaskOrg('C1');
    msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('SetCoaTaskOrg');
    expect(msg.params).toEqual({ affiliation: 'C1' });

    // importCoaContent
    connector.response = 'COA-NEW';
    const newCoa = await recognizer.importCoaContent('object_set([[coa]])');
    msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('ImportCoaContent');
    expect(msg.params).toEqual({ content: 'object_set([[coa]])' });
    expect(newCoa).toBe('COA-NEW');

    // getCoaContent
    connector.response = 'object_set([[coa2]])';
    const coaContent = await recognizer.getCoaContent('C1');
    msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetCoaContent');
    expect(msg.params).toEqual({ poid: 'C1' });
    expect(coaContent).toBe('object_set([[coa2]])');

    // setCurrentCoa
    await recognizer.setCurrentCoa('C1');
    msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('SetCurrentCoa');
    expect(msg.params).toEqual({ poid: 'C1' });

    // deleteCoa
    recognizer.deleteCoa('C1');
    const imsg = JSON.parse(connector.lastInformMessage!);
    expect(imsg.method).toBe('DeleteCoa');
    expect(imsg.params).toEqual({ poid: 'C1' });
  });

  it('private promiseWithTimeout rejects when timeout expires first', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector) as any;
    const never = new Promise(() => { /* never resolves */ });

    await expect(recognizer.promiseWithTimeout(0.01, never)).rejects.toThrow(
      /Operation timed out/
    );
  });

  it('Role and sketch/speech informs format payloads', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    // setCurrentRole
    await recognizer.setCurrentRole({ name: 'Commander' } as any, true);
    let msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('SetRole');
    expect(msg.params).toEqual({ role: { name: 'Commander' } });

    // sendPenDown
    recognizer.sendPenDown({ lat: 1, lon: 2 } as any, '2024-01-01T00:00:00Z');
    let imsg = JSON.parse(connector.lastInformMessage!);
    expect(imsg.method).toBe('SendPenDown');
    expect(imsg.params).toEqual({ location: { lat: 1, lon: 2 }, timestamp: '2024-01-01T00:00:00Z' });

    // sendInk
    recognizer.sendInk({ width: 100, height: 200 } as any, { lat: 10, lon: 20 } as any, { lat: 30, lon: 40 } as any, [{ lat: 1, lon: 2 }] as any, 't1', 't2', ['S1']);
    imsg = JSON.parse(connector.lastInformMessage!);
    expect(imsg.method).toBe('SendInk');
    expect(imsg.params).toEqual({
      pixelBoundsWindow: { width: 100, height: 200 },
      topLeftGeoMap: { lat: 10, lon: 20 },
      bottomRightGeoMap: { lat: 30, lon: 40 },
      strokePoints: [{ lat: 1, lon: 2 }],
      timeStrokeStart: 't1',
      timeStrokeEnd: 't2',
      intersectedPoids: ['S1'],
    });

    // sendSpeechRecognition
    const start = new Date('2024-02-01T00:00:00Z');
    const end = new Date('2024-02-01T00:01:00Z');
    recognizer.sendSpeechRecognition([{ text: 'hello' } as any], start, end);
    imsg = JSON.parse(connector.lastInformMessage!);
    expect(imsg.method).toBe('SendSpeechRecognition');
    expect(imsg.params.recoList).toEqual([{ text: 'hello' }]);
    expect(imsg.params.startTime).toBe(start.toISOString());
    expect(imsg.params.endTime).toBe(end.toISOString());

    // sendSimulatedSpeechRecognition - text only
    recognizer.sendSimulatedSpeechRecognition('infantry company');
    imsg = JSON.parse(connector.lastInformMessage!);
    expect(imsg.method).toBe('SendSimulatedSpeechRecognition');
    expect(imsg.params).toEqual({ text: 'infantry company', startTime: null });

    // sendSimulatedSpeechRecognition - text with startTime
    const simStart = new Date('2024-03-01T12:00:00Z');
    recognizer.sendSimulatedSpeechRecognition('armor platoon', simStart);
    imsg = JSON.parse(connector.lastInformMessage!);
    expect(imsg.method).toBe('SendSimulatedSpeechRecognition');
    expect(imsg.params).toEqual({ text: 'armor platoon', startTime: simStart.toISOString() });
  });

  // ─── ObjectSet method tests ───────────────────────────────────────

  it('loadNewScenarioFromObjectSet sends objects payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const objects = [{ poid: 'S1', fsTYPE: 'unit' }] as any;
    await recognizer.loadNewScenarioFromObjectSet(objects);
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('LoadNewScenarioFromObjectSet');
    expect(msg.params).toEqual({ objects });
  });

  it('importPlanDataFromObjectSet sends objects payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const objects = [{ poid: 'S2', fsTYPE: 'unit' }] as any;
    await recognizer.importPlanDataFromObjectSet(objects);
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('ImportPlanDataFromObjectSet');
    expect(msg.params).toEqual({ objects });
  });

  it('getScenarioObjectSet requests with null params', async () => {
    const connector = new SpyConnector();
    connector.response = [{ poid: 'S1' }];
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getScenarioObjectSet();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetScenarioObjectSet');
    expect(msg.params).toBeNull();
    expect(result).toEqual([{ poid: 'S1' }]);
  });

  it('syncScenarioSessionFromObjectSet sends objects payload', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const objects = [{ poid: 'S3', fsTYPE: 'unit' }] as any;
    await recognizer.syncScenarioSessionFromObjectSet(objects);
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('SyncScenarioSessionFromObjectSet');
    expect(msg.params).toEqual({ objects });
  });

  it('importTaskOrgFromObjectSet sends objects and returns poid', async () => {
    const connector = new SpyConnector();
    connector.response = 'TO-NEW';
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const objects = [{ poid: 'TO1', fsTYPE: 'task_org' }] as any;
    const result = await recognizer.importTaskOrgFromObjectSet(objects);
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('ImportTaskOrgFromObjectSet');
    expect(msg.params).toEqual({ objects });
    expect(result).toBe('TO-NEW');
  });

  it('getTaskOrgObjectSet sends poid and returns objects', async () => {
    const connector = new SpyConnector();
    connector.response = [{ poid: 'TO1', fsTYPE: 'task_org' }];
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getTaskOrgObjectSet('TO1');
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetTaskOrgObjectSet');
    expect(msg.params).toEqual({ poid: 'TO1' });
    expect(result).toEqual([{ poid: 'TO1', fsTYPE: 'task_org' }]);
  });

  it('importCoaFromObjectSet sends objects and returns poid', async () => {
    const connector = new SpyConnector();
    connector.response = 'COA-NEW';
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const objects = [{ poid: 'C1', fsTYPE: 'coa' }] as any;
    const result = await recognizer.importCoaFromObjectSet(objects);
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('ImportCoaFromObjectSet');
    expect(msg.params).toEqual({ objects });
    expect(result).toBe('COA-NEW');
  });

  it('getCoaObjectSet sends poid and returns objects', async () => {
    const connector = new SpyConnector();
    connector.response = [{ poid: 'C1', fsTYPE: 'coa' }];
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getCoaObjectSet('C1');
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetCoaObjectSet');
    expect(msg.params).toEqual({ poid: 'C1' });
    expect(result).toEqual([{ poid: 'C1', fsTYPE: 'coa' }]);
  });
});
