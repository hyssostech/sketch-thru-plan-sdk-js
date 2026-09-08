import { describe, it, expect } from 'vitest';
import { StpRecognizer } from '../src/stprecognizer.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';
import * as StpType from '../src/stptypes';

// Connector double that records the last inform/request message sent, and lets a test
// script a canned response for request() - same pattern as the other command test files.
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
    return 'PARITY17-SESSION';
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

describe('StpRecognizer - 17 method parity with the .NET SDK / engine bridge arms', () => {
  // --- Informs (fire and forget) ---

  it('changeTimeOut informs ChangeTimeOut with timeout', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.changeTimeOut(2.5);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('ChangeTimeOut');
    expect(msg.params).toEqual({ timeout: 2.5 });
  });

  it('resetSegmentationTimeout informs ResetSegmentationTimeout with null params', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.resetSegmentationTimeout();
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('ResetSegmentationTimeout');
    expect(msg.params).toBeNull();
  });

  it('setSpeechListening informs SetSpeechListening with listen', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.setSpeechListening(true);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('SetSpeechListening');
    expect(msg.params).toEqual({ listen: true });
  });

  it('recognizeNow informs RecognizeNow with null params', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.recognizeNow();
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('RecognizeNow');
    expect(msg.params).toBeNull();
  });

  it('sendListen informs SendListen with mode and time', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const time = new Date('2024-05-01T00:00:00Z');
    recognizer.sendListen(StpType.ListenMode.Once, time);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('SendListen');
    expect(msg.params).toEqual({ mode: 'once', time: time.toISOString() });
  });

  it('sendListen defaults time to null when omitted', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.sendListen(StpType.ListenMode.Off);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('SendListen');
    expect(msg.params).toEqual({ mode: 'off', time: null });
  });

  it('sendAudioCaptureState informs SendAudioCaptureState with isListening', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.sendAudioCaptureState(false);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('SendAudioCaptureState');
    expect(msg.params).toEqual({ isListening: false });
  });

  it('advertiseViewport informs AdvertiseViewport with topLeft/botRight', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const topLeft = new StpType.LatLon(10, 20);
    const botRight = new StpType.LatLon(5, 25);
    recognizer.advertiseViewport(topLeft, botRight);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('AdvertiseViewport');
    expect(msg.params).toEqual({
      topLeft: { lat: 10, lon: 20 },
      botRight: { lat: 5, lon: 25 }
    });
  });

  it('setAutoTasking informs SetAutoTasking with isEnabled', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.setAutoTasking(true);
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('SetAutoTasking');
    expect(msg.params).toEqual({ isEnabled: true });
  });

  it('resetRole informs ResetRole with null params', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.resetRole();
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('ResetRole');
    expect(msg.params).toBeNull();
  });

  it('undoLastOp informs UndoLastOp with poid', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    recognizer.undoLastOp('P1');
    const msg = JSON.parse(connector.lastInformMessage!);
    expect(msg.method).toBe('UndoLastOp');
    expect(msg.params).toEqual({ poid: 'P1' });
  });

  // --- Requests (round-trip, return a value) ---

  it('resetStpScenario requests ResetStpScenario with null params', async () => {
    const connector = new SpyConnector();
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    await recognizer.resetStpScenario();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('ResetStpScenario');
    expect(msg.params).toBeNull();
  });

  it('getActiveScenarioDescription requests GetActiveScenarioDescription and returns the value', async () => {
    const connector = new SpyConnector();
    connector.response = { name: 'Scenario1', poid: 'SC1', sessionId: 'SESS1' };
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getActiveScenarioDescription();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetActiveScenarioDescription');
    expect(msg.params).toBeNull();
    expect(result).toEqual({ name: 'Scenario1', poid: 'SC1', sessionId: 'SESS1' });
  });

  it('getAllObjects requests GetAllObjects and returns the array', async () => {
    const connector = new SpyConnector();
    connector.response = [{ poid: 'S1' }, { poid: 'S2' }];
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getAllObjects();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetAllObjects');
    expect(msg.params).toBeNull();
    expect(result).toEqual([{ poid: 'S1' }, { poid: 'S2' }]);
  });

  it('getDeletedObjects requests GetDeletedObjects and returns the array', async () => {
    const connector = new SpyConnector();
    connector.response = [{ poid: 'D1' }];
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getDeletedObjects();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetDeletedObjects');
    expect(msg.params).toBeNull();
    expect(result).toEqual([{ poid: 'D1' }]);
  });

  it('getPoidObject requests GetPoidObject with poid and returns the object', async () => {
    const connector = new SpyConnector();
    connector.response = { poid: 'P1', fsTYPE: 'unit' };
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getPoidObject('P1');
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetPoidObject');
    expect(msg.params).toEqual({ poid: 'P1' });
    expect(result).toEqual({ poid: 'P1', fsTYPE: 'unit' });
  });

  it('getScenarioTaskOrgList requests GetScenarioTaskOrgList and returns the array', async () => {
    const connector = new SpyConnector();
    connector.response = [{ poid: 'TO1', fsTYPE: 'task_org' }];
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getScenarioTaskOrgList();
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetScenarioTaskOrgList');
    expect(msg.params).toBeNull();
    expect(result).toEqual([{ poid: 'TO1', fsTYPE: 'task_org' }]);
  });

  it('getTaskOrgObjects requests GetTaskOrgObjects with poid and returns the array', async () => {
    const connector = new SpyConnector();
    connector.response = [{ poid: 'TO1', fsTYPE: 'task_org_unit' }];
    const recognizer = new StpRecognizer(connector);
    await recognizer.connect('Svc', 1);

    const result = await recognizer.getTaskOrgObjects('TO1');
    const msg = JSON.parse(connector.lastRequestMessage!);
    expect(msg.method).toBe('GetTaskOrgObjects');
    expect(msg.params).toEqual({ poid: 'TO1' });
    expect(result).toEqual([{ poid: 'TO1', fsTYPE: 'task_org_unit' }]);
  });
});
