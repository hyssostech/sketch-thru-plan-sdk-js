#!/usr/bin/env node
// Generates samples/PARITY.md: every method and event of the STP contract (json-api/sketch-thru-plan-api.json),
// the JS SDK member that carries it and the JS samples that show it, and the same for the .NET SDK and its samples.
// Generated from the contract so nothing is missed.
//
//   node scripts/sample-parity.mjs                    write samples/PARITY.md
//   node scripts/sample-parity.mjs --check            exit 1 if samples/PARITY.md is out of date
//   node scripts/sample-parity.mjs --net <clone>      first refresh samples/parity-net.json from a clone of
//                                                     hyssostech/sketch-thru-plan-sdk-net, then write the table
//
// Each JS name is checked against the built type declarations (dist/sketch-thru-plan-sdk-bundle.d.ts), so run
// `npm run build` first. A name the SDK does not declare stops the script: fix the mapping below, not the table.
//
// The .NET columns come from samples/parity-net.json, which --net extracts from the .NET repository's source: the
// public SDK member that sends each wire method (or the handler that each event's subscription keys on), and the
// .NET samples whose code calls or subscribes to it. The file records the .NET commit it was taken from, so the
// table can be regenerated and checked without the clone.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NET_PENDING = 'pending (STP-1802)';
const netJsonPath = join(root, 'samples/parity-net.json');
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

// The files under `dir` whose name matches `keep` (build output and dependencies skipped)
const listFiles = (dir, keep, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (['node_modules', 'dist', 'bin', 'obj', '.git'].includes(f)) continue;
    if (statSync(p).isDirectory()) listFiles(p, keep, out);
    else if (keep(f)) out.push(p);
  }
  return out;
};

//#region .NET extraction (--net)
/**
 * Read the .NET SDK and samples from a clone: for each contract method, the public members that send it (directly,
 * or through one other public member), and the samples that call them; for each event, the handler its subscription
 * keys on and the samples that subscribe to it
 */
function extractNet(netRoot) {
  const sdkFiles = listFiles(join(netRoot, 'src'), (f) => f.endsWith('.cs'));
  const sdk = sdkFiles.map((f) => readFileSync(f, 'utf8'));
  // Public members, with their bodies (a body runs to the next public/private/internal/protected member)
  const members = [];
  for (const text of sdk) {
    const decl = /\n\s*public\s+(?:static\s+|async\s+|override\s+|virtual\s+)*[\w<>\[\](),.? ]+?\s+(\w+)\s*\(/g;
    const starts = [...text.matchAll(decl)];
    starts.forEach((m, i) => {
      if (/\bdelegate\b/.test(m[0])) return;
      const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
      members.push({ name: m[1], body: text.slice(m.index, end) });
    });
  }
  const sampleFiles = [
    ...listFiles(join(netRoot, 'samples'), (f) => f.endsWith('.cs') && !/Designer\.cs$/.test(f)),
    ...listFiles(join(netRoot, 'quickstart'), (f) => f.endsWith('.cs') && !/Designer\.cs$/.test(f)),
  ];
  const sampleCode = sampleFiles.map((f) => {
    const rel = relative(netRoot, f).split('\\').join('/');
    return { sample: rel.startsWith('quickstart/') ? 'quickstart' : rel.split('/')[1], text: readFileSync(f, 'utf8') };
  });
  const used = (re) => [...new Set(sampleCode.filter((s) => re.test(s.text)).map((s) => s.sample))].sort();

  const methods = {};
  for (const m of contract.methods) {
    const wire = new RegExp(`(?:Send\\w*\\(|Method\\s*=\\s*)\\s*"${m.name}"`);
    const direct = [...new Set(members.filter((x) => wire.test(x.body)).map((x) => x.name))];
    const via = [...new Set(members
      .filter((x) => !direct.includes(x.name) && direct.some((d) => new RegExp(`\\b${d}\\s*\\(`).test(x.body)))
      .map((x) => x.name))];
    const samples = used(new RegExp(`\\.(?:${direct.join('|') || '$^'})\\s*\\(`));
    // Each sample that reaches it only through another member, with the members it uses
    const viaSamples = [];
    for (const v of via) {
      for (const s of used(new RegExp(`\\.${v}\\s*\\(`))) {
        if (samples.includes(s)) continue;
        const entry = viaSamples.find((x) => x.sample === s) ?? viaSamples[viaSamples.push({ sample: s, via: [] }) - 1];
        entry.via.push(v);
      }
    }
    viaSamples.sort((a, b) => a.sample.localeCompare(b.sample));
    methods[m.name] = { sdk: direct, via, samples, viaSamples };
  }
  // SearchSymbol is answered by the SDK, not sent: its member is SymbolSearch.Search
  if (sdk.some((t) => /class SymbolSearch\b/.test(t) && /public IReadOnlyList<SymbolSearchResult> Search\(/.test(t))) {
    methods.SearchSymbol = { sdk: ['SymbolSearch.Search'], via: [], samples: used(/\bSymbolSearch\b/), viaSamples: [] };
  }

  const events = {};
  const recognizer = sdk.join('\n');
  for (const e of contract['x-stpEvents']) {
    const sub = recognizer.match(new RegExp(`if \\((On\\w+) != null[^)]*\\) solvables\\.Add\\("${e.name}"\\)`));
    const handler = sub ? sub[1] : null;
    events[e.name] = { sdk: handler ? [handler] : [], samples: handler ? used(new RegExp(`\\b${handler}\\s*\\+=`)) : [] };
  }
  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['-C', netRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch { /* not a git clone */ }
  return { repo: 'hyssostech/sketch-thru-plan-sdk-net', commit, methods, events };
}

const netArg = process.argv.indexOf('--net');
if (netArg >= 0) {
  const netRoot = resolve(process.argv[netArg + 1] ?? '');
  if (!existsSync(join(netRoot, 'src'))) {
    console.error('--net needs the path of a clone of hyssostech/sketch-thru-plan-sdk-net');
    process.exit(2);
  }
  writeFileSync(netJsonPath, JSON.stringify(extractNet(netRoot), null, 1) + '\n');
  console.log('wrote samples/parity-net.json');
}
const net = existsSync(netJsonPath) ? JSON.parse(readFileSync(netJsonPath, 'utf8')) : null;
const netSdk = (entry) => (entry?.sdk?.length ? entry.sdk.map((n) => `\`${n}\``).join(', ') : '-');
const netShown = (entry) => {
  const list = [
    ...(entry?.samples ?? []),
    ...(entry?.viaSamples ?? []).map((s) => `${s.sample} (via ${s.via.join(', ')})`),
  ];
  return list.length ? list.join(', ') : NET_PENDING;
};
//#endregion

// The code of each JS sample (mock engines excluded: they name every method without showing it)
const SAMPLE_FILES = [
  ...listFiles(join(root, 'samples'), (f) => /\.(js|ts|tsx)$/.test(f) && !/mockstp|\.d\.ts$|vite\.config|check-browser/.test(f)),
  ...listFiles(join(root, 'quickstart'), (f) => /\.(js|ts|tsx)$/.test(f) && !/mockstp|\.d\.ts$|vite\.config|check-browser/.test(f)),
];
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
  const n = net?.methods?.[m.name];
  rows.push({
    kind: 'method', contract: m.name + layer, js: `${o.owner}.${o.name}`, shown: shown || '**none**',
    netSdk: o.transport ? '-' : netSdk(n), netShown: o.transport ? 'every sample (transport)' : netShown(n), note: o.note ?? '',
  });
}
for (const e of contract['x-stpEvents']) {
  const o = EVENT_OVERRIDES[e.name] ?? { owner: 'StpRecognizer', name: 'on' + e.name };
  if (o.name && !declared(o.owner, o.name)) problems.push(`event ${e.name}: ${o.owner}.${o.name} is not declared`);
  let shown = o.name ? samplesUsing([new RegExp(`\\.${o.name}\\s*=`)]).map(link).join(', ') : '';
  if (o.transport) shown = 'every sample (transport)';
  const n = net?.events?.[e.name];
  rows.push({
    kind: 'event', contract: e.name, js: o.name ? `${o.owner}.${o.name}` : '-', shown: shown || '**none**',
    netSdk: o.transport ? '-' : netSdk(n), netShown: o.transport ? 'every sample (transport)' : netShown(n), note: o.note ?? '',
  });
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const table = (kind) => [
  `| Contract ${kind} | JS SDK | JS sample | .NET SDK | .NET sample | Note |`,
  '|---|---|---|---|---|---|',
  ...rows.filter((r) => r.kind === kind)
    .map((r) => `| ${r.contract} | \`${r.js}\` | ${r.shown} | ${r.netSdk} | ${r.netShown} | ${r.note} |`),
].join('\n');
const none = rows.filter((r) => r.shown === '**none**');
const netNone = rows.filter((r) => r.netShown === NET_PENDING);
const netSource = net
  ? `The .NET columns are taken from [${net.repo}](https://github.com/${net.repo}) at commit \`${net.commit.slice(0, 12)}\`
(\`samples/parity-net.json\`; refresh with \`--net <clone>\`): the public .NET member that sends the method, or the
handler its event subscription keys on, and the .NET samples (\`samples/<name>\`, \`quickstart\`) that use it.
"${NET_PENDING}" marks a capability no .NET sample shows yet.`
  : 'No .NET data (samples/parity-net.json is missing; run with `--net <clone>`).';
const md = `# STP contract parity: methods and events in the JS and .NET SDKs and their samples

Generated by \`node scripts/sample-parity.mjs\` from \`json-api/sketch-thru-plan-api.json\` (contract
${contract.info.version}) and the built SDK types - do not edit by hand. "Shown in" lists the samples whose code calls
the method or assigns the handler; "via" means a sample uses a higher-level SDK call that sends it.

${netSource}

${contract.methods.length} methods and ${contract['x-stpEvents'].length} events; ${none.length} are shown in no JS sample,
${netNone.length} in no .NET sample.

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
  console.log(`wrote samples/PARITY.md: ${rows.length} rows, ${none.length} in no JS sample, ${netNone.length} in no .NET sample`);
}
