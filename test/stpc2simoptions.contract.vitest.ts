import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { StpRecognizer } from '../src/stprecognizer.ts';
import { StpC2SIMOptions } from '../src/stpc2simoptions.ts';
import type { IStpConnector } from '../src/interfaces/IStpConnector';

/**
 * STP-694 (ruled B). The OpenRPC contract spells the C2SIM `options` keys exactly as
 * StpC2SIMOptions names its fields, because that is what the SDK sends and the options
 * schemas are additionalProperties:false - a strict validator compares property names
 * case-sensitively. The engine matches keys case-insensitively (STP
 * NallSuite/Agents/C2SimBridge/C2SimBridgeAgent.cs, UpdateC2SIMParams), so until 0.6.17
 * the contract's lowercase keys (resturl) and the SDK's camelCase (restUrl) both worked on
 * the wire while the contract rejected everything the SDK sent. These tests keep the two
 * spelled alike in both directions.
 *
 * The rules of engagement VALUE is matched case-sensitively by the engine
 * (SDK/Engine/Utility/ObjectFactory.cs, Enum.Parse over C2SimBridgeParams.ROE
 * { Hold, Free, Tight }); a value it cannot parse is dropped with a warning and the
 * configured default kept. The SDK's 'ROEHold' / 'ROEFree' / 'ROETight' were never
 * accepted, so they are now sent as the engine's value.
 */

const ROOT = process.cwd();
const CONTRACT = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'json-api', 'sketch-thru-plan-api.json'), 'utf8'),
);
const OPTIONS_SOURCE = path.join(ROOT, 'src', 'stpc2simoptions.ts');

type Schema = { [key: string]: any };

function resolve(schema: Schema): Schema {
  // Local $refs only, as the contract uses them (#/components/schemas/Name).
  while (schema && typeof schema.$ref === 'string') {
    const parts = schema.$ref.replace(/^#\//, '').split('/');
    schema = parts.reduce((node: Schema, key: string) => node[key], CONTRACT);
  }
  return schema;
}

/** The C2SIM methods whose `options` schema enumerates properties - the gated set. */
function gatedOptionSchemas(): Map<string, Schema> {
  const out = new Map<string, Schema>();
  for (const method of CONTRACT.methods) {
    if (!method.name.includes('C2SIM')) continue;
    const param = (method.params ?? []).find((p: Schema) => p.name === 'options');
    const schema = param && resolve(param.schema);
    if (schema?.properties) out.set(method.name, schema);
  }
  return out;
}

/** The declared fields of StpC2SIMOptions, read from source (types do not survive to runtime). */
function sourceFields(): Map<string, ts.TypeNode | undefined> {
  const file = ts.createSourceFile(
    OPTIONS_SOURCE, fs.readFileSync(OPTIONS_SOURCE, 'utf8'), ts.ScriptTarget.Latest, true);
  const fields = new Map<string, ts.TypeNode | undefined>();
  file.forEachChild((node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === 'StpC2SIMOptions') {
      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
          fields.set(member.name.text, member.type);
        }
      }
    }
  });
  return fields;
}

/** The string literals a type allows, following local type aliases. */
function stringLiterals(type: ts.TypeNode | undefined): string[] {
  if (!type) return [];
  if (ts.isUnionTypeNode(type)) return type.types.flatMap(stringLiterals);
  if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) return [type.literal.text];
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    const name = type.typeName.text;
    const file = type.getSourceFile();
    let alias: ts.TypeNode | undefined;
    file.forEachChild((node) => {
      if (ts.isTypeAliasDeclaration(node) && node.name.text === name) alias = node.type;
    });
    return stringLiterals(alias);
  }
  return [];
}

class MockConnector implements IStpConnector {
  baseName?: string;
  name: string | undefined;
  isConnected = true;
  requests: string[] = [];
  onInform: ((message: string) => void) | undefined;
  onRequest: ((message: string) => string[]) | undefined;
  onError: ((error: string) => void) | undefined;
  connect(serviceName: string): Promise<string | undefined> {
    this.name = serviceName;
    return Promise.resolve('C2SIM-OPTIONS');
  }
  disconnect(): Promise<void> { return Promise.resolve(); }
  inform(): Promise<void> { return Promise.resolve(); }
  request(message: string): Promise<any> {
    this.requests.push(message);
    return Promise.resolve('content');
  }
}

describe('StpC2SIMOptions <-> contract options keys (STP-694)', () => {
  const schemas = gatedOptionSchemas();
  const fields = sourceFields();

  it('finds what it compares - an extractor that matches nothing proves nothing', () => {
    expect(new Set(schemas.keys())).toEqual(
      new Set(['GetC2SIMContent', 'PullC2SIMInitialization', 'PushC2SIMContent']));
    expect(fields.size).toBeGreaterThanOrEqual(30);
  });

  for (const [method, schema] of gatedOptionSchemas()) {
    it(`${method}: every StpC2SIMOptions field is a contract key, verbatim`, () => {
      const keys = Object.keys(schema.properties);
      const missing = [...fields.keys()].filter((f) => !keys.includes(f));
      expect(missing, `fields the contract does not list (case-sensitive)`).toEqual([]);
    });

    it(`${method}: every contract key is a StpC2SIMOptions field, verbatim`, () => {
      const extra = Object.keys(schema.properties).filter((k) => !fields.has(k));
      expect(extra, `contract keys StpC2SIMOptions lacks (case-sensitive)`).toEqual([]);
    });

    it(`${method}: options stay closed, so a misspelled key is refused`, () => {
      expect(schema.additionalProperties).toBe(false);
    });

    it(`${method}: rulesOfEngagement values are the contract enum, plus deprecated ROE* spellings of it`, () => {
      const contractEnum: string[] = schema.properties.rulesOfEngagement.enum;
      const literals = stringLiterals(fields.get('rulesOfEngagement'));
      const legacy = literals.filter((v) => v.startsWith('ROE'));
      expect(new Set(literals.filter((v) => !v.startsWith('ROE')))).toEqual(new Set(contractEnum));
      expect(new Set(legacy.map((v) => v.slice(3)))).toEqual(new Set(contractEnum));
    });
  }
});

describe('C2SIM options on the wire (STP-694)', () => {
  async function sentOptions(options: StpC2SIMOptions): Promise<Schema> {
    const connector = new MockConnector();
    const proxy = new StpRecognizer(connector).createC2SIMProxy(options);
    await proxy.getC2SIMContent('Scenario', 'initialization');
    return JSON.parse(connector.requests.at(-1)!).params.options;
  }

  it('a deprecated ROE spelling is sent as the engine value, without touching the caller object', async () => {
    const contractEnum: string[] =
      gatedOptionSchemas().get('GetC2SIMContent')!.properties.rulesOfEngagement.enum;
    for (const [legacy, engine] of [['ROEHold', 'Hold'], ['ROEFree', 'Free'], ['ROETight', 'Tight']] as const) {
      const options = new StpC2SIMOptions();
      options.rulesOfEngagement = legacy;
      const sent = await sentOptions(options);
      expect(sent.rulesOfEngagement).toBe(engine);
      expect(contractEnum).toContain(sent.rulesOfEngagement);
      expect(options.rulesOfEngagement).toBe(legacy);
    }
  });

  it('an engine ROE value goes out unchanged', async () => {
    const options = new StpC2SIMOptions();
    options.rulesOfEngagement = 'Tight';
    expect((await sentOptions(options)).rulesOfEngagement).toBe('Tight');
  });

  it('every key the SDK sends is one the contract lists, as spelled', async () => {
    const options = new StpC2SIMOptions();
    options.systemName = 'STP';
    options.fullTO = true;
    options.entityNameCharLimit = 63;
    options.includeDescriptionInName = true;
    options.validationSchema = '';
    options.fromSenderUUID = '00000000-0000-0001-0001-000000000000';
    options.rulesOfEngagement = 'ROEFree';
    const sent = await sentOptions(options);
    const keys = Object.keys(gatedOptionSchemas().get('GetC2SIMContent')!.properties);
    expect(Object.keys(sent).length).toBe(7);
    expect(Object.keys(sent).filter((k) => !keys.includes(k))).toEqual([]);
  });
});
