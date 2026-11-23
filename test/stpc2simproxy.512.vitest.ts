import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { StpRecognizer } from '../src/stprecognizer.ts';
import { StpC2SIMOptions } from '../src/stpc2simoptions.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';

/**
 * STP-1800. The 5.12 C2SIM surface as the SDK sends it: ConvertC2SIMContent, and the
 * refuseUnconfirmedPlaceholders option (STP-973) on GetC2SIMContent, PullC2SIMInitialization
 * and PushC2SIMContent - sent under its camelCase key, the one the contract lists.
 */

const CONTRACT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'json-api', 'sketch-thru-plan-api.json'), 'utf8'),
);
type Schema = { [key: string]: any };
const method = (name: string): Schema => CONTRACT.methods.find((m: Schema) => m.name === name);

function resolve(schema: Schema): Schema {
  while (schema && typeof schema.$ref === 'string') {
    const parts = schema.$ref.replace(/^#\//, '').split('/');
    schema = parts.reduce((node: Schema, key: string) => node[key], CONTRACT);
  }
  return schema;
}
const optionsSchema = (name: string): Schema =>
  resolve(method(name).params.find((p: Schema) => p.name === 'options').schema);

class MockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = true;
  requests: string[] = [];
  response: any = 'content';
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  connect(serviceName: string): Promise<string | undefined> {
    this.name = serviceName;
    return Promise.resolve('C2SIM-512');
  }
  disconnect(): Promise<void> { return Promise.resolve(); }
  inform(): Promise<void> { return Promise.resolve(); }
  request(message: string): Promise<any> {
    this.requests.push(message);
    return Promise.resolve(this.response);
  }
  last(): Schema { return JSON.parse(this.requests.at(-1)!); }
}

function proxyWith(options?: StpC2SIMOptions) {
  const connector = new MockConnector();
  const proxy = new StpRecognizer(connector).createC2SIMProxy(options);
  return { connector, proxy };
}

describe('convertC2SIMContent (STP-1800)', () => {
  it('requests ConvertC2SIMContent with the content and returns the engine answer', async () => {
    const { connector, proxy } = proxyWith(new StpC2SIMOptions());
    connector.response = 'object_set([[a], [b]])';
    const result = await proxy.convertC2SIMContent('<C2SIMInitializationBody/>');
    const msg = connector.last();
    expect(msg.method).toBe('ConvertC2SIMContent');
    expect(msg.params.content).toBe('<C2SIMInitializationBody/>');
    expect(result).toBe('object_set([[a], [b]])');
  });

  it('sends only the params the contract declares, in order', async () => {
    const { connector, proxy } = proxyWith(new StpC2SIMOptions());
    await proxy.convertC2SIMContent('<x/>');
    const declared = method('ConvertC2SIMContent').params.map((p: Schema) => p.name);
    expect(Object.keys(connector.last().params)).toEqual(declared);
  });

  it('is a request with a string result, as the contract says', () => {
    const m = method('ConvertC2SIMContent');
    expect(m['x-stpInform']).not.toBe(true);
    expect(resolve(m.result.schema).type).toBe('string');
  });

  it('importInitializationFromC2SIMServer pulls, converts the pulled content, then syncs it', async () => {
    const { connector, proxy } = proxyWith(new StpC2SIMOptions());
    const answers = ['<pulled/>', 'object_set([[converted]])', null];
    connector.request = (message: string) => {
      connector.requests.push(message);
      return Promise.resolve(answers.shift());
    };
    await proxy.importInitializationFromC2SIMServer();
    const sent = connector.requests.map((r) => JSON.parse(r));
    expect(sent.map((m) => m.method)).toEqual([
      'PullC2SIMInitialization', 'ConvertC2SIMContent', 'SyncScenarioSession']);
    expect(sent[1].params.content).toBe('<pulled/>');
  });
});

describe('refuseUnconfirmedPlaceholders C2SIM option (STP-973, STP-1800)', () => {
  const calls: Array<[string, (p: ReturnType<typeof proxyWith>['proxy']) => Promise<unknown>]> = [
    ['GetC2SIMContent', (p) => p.getC2SIMContent('Scenario', 'order')],
    ['PullC2SIMInitialization', (p) => p.pullC2SIMInitialization()],
    ['PushC2SIMContent', (p) => p.pushC2SIMContent('<C2SIM/>', 'order')],
  ];

  for (const [name, call] of calls) {
    it(`${name}: the contract lists the camelCase key as a boolean`, () => {
      const prop = optionsSchema(name).properties.refuseUnconfirmedPlaceholders;
      expect(prop).toBeDefined();
      expect(prop.type).toBe('boolean');
    });

    for (const value of [true, false]) {
      it(`${name}: sends refuseUnconfirmedPlaceholders=${value} under its camelCase key`, async () => {
        const options = new StpC2SIMOptions();
        options.refuseUnconfirmedPlaceholders = value;
        const { connector, proxy } = proxyWith(options);
        await call(proxy);
        const msg = connector.last();
        expect(msg.method).toBe(name);
        expect(msg.params.options).toEqual({ refuseUnconfirmedPlaceholders: value });
        expect(Object.keys(msg.params.options)).toEqual(['refuseUnconfirmedPlaceholders']);
      });
    }

    it(`${name}: left unset, the key is not sent and the engine default (false) applies`, async () => {
      const options = new StpC2SIMOptions();
      options.fullTO = true;
      const { connector, proxy } = proxyWith(options);
      await call(proxy);
      expect(connector.last().params.options).not.toHaveProperty('refuseUnconfirmedPlaceholders');
      expect(connector.last().params.options).toEqual({ fullTO: true });
    });
  }

  it('is sent alongside a deprecated ROE spelling that the SDK rewrites', async () => {
    const options = new StpC2SIMOptions();
    options.refuseUnconfirmedPlaceholders = true;
    options.rulesOfEngagement = 'ROEHold';
    const { connector, proxy } = proxyWith(options);
    await proxy.getC2SIMContent('Scenario', 'initialization');
    expect(connector.last().params.options).toEqual({
      refuseUnconfirmedPlaceholders: true, rulesOfEngagement: 'Hold' });
  });

  it('exportPlanDataToC2SIMServer carries it on both the get and the push', async () => {
    const options = new StpC2SIMOptions();
    options.refuseUnconfirmedPlaceholders = true;
    const { connector, proxy } = proxyWith(options);
    await proxy.exportPlanDataToC2SIMServer('Scenario', 'order');
    const sent = connector.requests.map((r) => JSON.parse(r));
    expect(sent.map((m) => m.method)).toEqual(['GetC2SIMContent', 'PushC2SIMContent']);
    for (const m of sent) expect(m.params.options.refuseUnconfirmedPlaceholders).toBe(true);
  });
});
