#!/usr/bin/env node
// Generates samples/PARITY.md: every method and event of the STP contract (json-api/sketch-thru-plan-api.json),
// the JS SDK member that carries it, and the samples that show it. Generated from the contract so nothing is missed.
//
//   node scripts/sample-parity.mjs           write samples/PARITY.md
//   node scripts/sample-parity.mjs --check   exit 1 if samples/PARITY.md is out of date
//
// Each JS name is checked against the built type declarations (dist/sketch-thru-plan-sdk-bundle.d.ts), so run
// `npm run build` first. A name the SDK does not declare stops the script: fix the mapping below, not the table.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'json-api/sketch-thru-plan-api.json'), 'utf8'));
const dtsPath = join(root, 'dist/sketch-thru-plan-sdk-bundle.d.ts');
if (!existsSync(dtsPath)) {
  console.error('dist/sketch-thru-plan-sdk-bundle.d.ts not found - run `npm run build` first');
  process.exit(2);
}
const dts = readFileSync(dtsPath, 'utf8');

// Contract methods whose JS member is not the contract name with a lower-case first letter on StpRecognizer
const METHOD_OVERRIDES = {
  SetRole: { owner: 'StpRecognizer', name: 'setCurrentRole' },
  Register: { owner: 'StpWebSocketsConnector', name: 'connect', note: 'sent by the connector; apps call StpRecognizer.connect' },
  Request: { owner: 'StpWebSocketsConnector', name: 'request', note: 'transport envelope of every request', transport: true },
  SearchSymbol: { owner: 'SymbolSearch', name: 'search', note: 'answered by the SDK from the symbol index (SymbolSearch.load)' },
  GetC2SIMContent: { owner: 'IC2SIMProxy', name: 'getC2SIMContent', via: ['exportPlanDataToC2SIMServer'] },
  PushC2SIMContent: { owner: 'IC2SIMProxy', name: 'pushC2SIMContent', via: ['exportPlanDataToC2SIMServer'] },
  PullC2SIMInitialization: { owner: 'IC2SIMProxy', name: 'pullC2SIMInitialization', via: ['importInitializationFromC2SIMServer'] },
  ConvertC2SIMContent: { owner: 'IC2SIMProxy', name: 'convertC2SIMContent', via: ['importInitializationFromC2SIMServer'] },
};
// Contract events whose JS handler is not StpRecognizer.on<Name>
const EVENT_OVERRIDES = {
  SymbolReport: { owner: 'IC2SIMProxy', name: 'onSymbolReport', note: 'relayed by the C2SIM proxy' },
  RequestResponse: { owner: 'StpWebSocketsConnector', name: null, note: 'consumed by the connector: resolves or rejects the request promise', transport: true },
};

// The code of each sample (mock engines excluded: they name every method without showing it)
const SAMPLE_FILES = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === 'node_modules' || f === 'dist') continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|ts|tsx)$/.test(f) && !/mockstp|\.d\.ts$|vite\.config|check-browser/.test(f)) SAMPLE_FILES.push(p);
  }
};
walk(join(root, 'samples'));
walk(join(root, 'quickstart'));
const sampleOf = (file) => {
  const rel = relative(root, file).split('\\').join('/');
  const m = rel.match(/^samples\/arcgis\/(ts|react)\//) ?? rel.match(/^samples\/([^/]+)\//) ?? rel.match(/^quickstart\/([^/]+)\//);
  if (rel.startsWith('samples/arcgis/')) return 'arcgis/' + m[1];
  if (rel.startsWith('quickstart/')) return 'quickstart/' + m[1];
  return m[1];
};
const code = SAMPLE_FILES.map((f) => ({ sample: sampleOf(f), text: readFileSync(f, 'utf8') }));
const samplesUsing = (regexes) => {
  const found = new Set();
  for (const { sample, text } of code) if (regexes.some((r) => r.test(text))) found.add(sample);
  return [...found].sort();
};

// The member must be declared on its owner in the built types
const declared = (owner, name) => {
  const start = dts.search(new RegExp(`(class|interface) ${owner}\\b`));
  if (start < 0) return false;
  const body = dts.slice(start, dts.indexOf('\n}', start));
  return new RegExp(`\\n\\s+(?:static\\s+)?(?:readonly\\s+)?${name}\\??[(:<]`).test(body);
};

const problems = [];
const rows = [];
const link = (s) => (s.startsWith('quickstart/') ? `[${s}](../${s})` : `[${s}](${s})`);

for (const m of contract.methods) {
  const o = METHOD_OVERRIDES[m.name] ?? { owner: 'StpRecognizer', name: m.name[0].toLowerCase() + m.name.slice(1) };
  if (!declared(o.owner, o.name)) problems.push(`method ${m.name}: ${o.owner}.${o.name} is not declared`);
  const direct = samplesUsing([new RegExp(`\\.${o.name}\\s*\\(`)]);
  const via = o.via ? samplesUsing(o.via.map((v) => new RegExp(`\\.${v}\\s*\\(`))).filter((s) => !direct.includes(s)) : [];
  let shown = [...direct.map(link), ...via.map((s) => link(s) + ` (via ${o.via.join(', ')})`)].join(', ');
  if (o.transport) shown = 'every sample (transport)';
  const layer = m['x-layer'] ? ` (${m['x-layer']})` : '';
  rows.push({ kind: 'method', contract: m.name + layer, js: `${o.owner}.${o.name}`, shown: shown || '**none**', note: o.note ?? '' });
}
for (const e of contract['x-stpEvents']) {
  const o = EVENT_OVERRIDES[e.name] ?? { owner: 'StpRecognizer', name: 'on' + e.name };
  if (o.name && !declared(o.owner, o.name)) problems.push(`event ${e.name}: ${o.owner}.${o.name} is not declared`);
  let shown = o.name ? samplesUsing([new RegExp(`\\.${o.name}\\s*=`)]).map(link).join(', ') : '';
  if (o.transport) shown = 'every sample (transport)';
  rows.push({ kind: 'event', contract: e.name, js: o.name ? `${o.owner}.${o.name}` : '-', shown: shown || '**none**', note: o.note ?? '' });
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const table = (kind) => [
  `| Contract ${kind} | JS SDK | Shown in | Note |`,
  '|---|---|---|---|',
  ...rows.filter((r) => r.kind === kind).map((r) => `| ${r.contract} | \`${r.js}\` | ${r.shown} | ${r.note} |`),
].join('\n');
const none = rows.filter((r) => r.shown === '**none**');
const md = `# STP contract parity: methods and events in the JS SDK and its samples

Generated by \`node scripts/sample-parity.mjs\` from \`json-api/sketch-thru-plan-api.json\` (contract
${contract.info.version}) and the built SDK types - do not edit by hand. "Shown in" lists the samples whose code calls
the method or assigns the handler; "via" means a sample uses a higher-level SDK call that sends it.

${contract.methods.length} methods and ${contract['x-stpEvents'].length} events; ${none.length} are shown in no sample.

## Methods

${table('method')}

## Events

${table('event')}
`;

const out = join(root, 'samples/PARITY.md');
if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== md) {
    console.error('samples/PARITY.md is out of date - run node scripts/sample-parity.mjs');
    process.exit(1);
  }
  console.log('samples/PARITY.md is up to date');
} else {
  writeFileSync(out, md);
  console.log(`wrote samples/PARITY.md: ${rows.length} rows, ${none.length} shown in no sample`);
}
