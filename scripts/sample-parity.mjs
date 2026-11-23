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
// The .NET columns come from samples/parity-net.json, which --net extracts from a clone of the .NET repository (the
// 5.12 branch, claude/STP-1797-net-512-calls, until it merges): the .NET name of each item, per that clone's
// docs/articles/contract-name-mapping.md, and the .NET samples whose code uses it. The file records the branch and
// commit it was taken from, so the table can be regenerated and checked without the clone. Without the file the
// table has the JS columns only.
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
 * Read the .NET names and samples from a clone of sketch-thru-plan-sdk-net. The .NET name of each contract item
 * follows docs/articles/contract-name-mapping.md in that clone: a method is its wire name plus `Async` (or the plain
 * name for a fire-and-forget call), an event is `On` plus its name (with the `Ext` twin that carries batchId),
 * except for the calls that document lists. A name is kept only if the SDK source declares it. A .NET sample shows
 * an item when its code calls the method or subscribes to the event; an `*FromObjectSet` overload counts only in a
 * file that also uses `ObjectSet`, since the overload shares its name with the text-content call
 */
function extractNet(netRoot) {
  const mappingPath = join(netRoot, 'docs/articles/contract-name-mapping.md');
  if (!existsSync(mappingPath)) {
    console.error('--net: docs/articles/contract-name-mapping.md not found in the clone (use the 5.12 branch)');
    process.exit(2);
  }
  // The documented exceptions: | `Wire` | `Owner.Member(args)` ... |
  const exceptions = {};
  for (const m of readFileSync(mappingPath, 'utf8').matchAll(/^\|\s*`(\w+)`\s*\|\s*`(\w+)\.(\w+)(\([^)]*\))?`/gm)) {
    exceptions[m[1]] = { owner: m[2], member: m[3], args: m[4] ?? '' };
  }
  // Public members and events the SDK declares
  const sdkText = listFiles(join(netRoot, 'src'), (f) => f.endsWith('.cs')).map((f) => readFileSync(f, 'utf8')).join('\n');
  const declaredNet = new Set([
    ...[...sdkText.matchAll(/\bpublic\s+(?:static\s+|async\s+|override\s+|virtual\s+)*[\w<>\[\](),.? ]+?\s+(\w+)\s*\(/g)].map((m) => m[1]),
    ...[...sdkText.matchAll(/\bpublic\s+event\s+[\w<>.]+\s+(\w+)\s*;/g)].map((m) => m[1]),
  ]);
  const sampleCode = [
    ...listFiles(join(netRoot, 'samples'), (f) => f.endsWith('.cs') && !/Designer\.cs$/.test(f)),
    ...listFiles(join(netRoot, 'quickstart'), (f) => f.endsWith('.cs') && !/Designer\.cs$/.test(f)),
  ].map((f) => {
    const rel = relative(netRoot, f).split('\\').join('/');
    return { sample: rel.startsWith('quickstart/') ? 'quickstart' : rel.split('/')[1], text: readFileSync(f, 'utf8') };
  });
  const used = (test) => [...new Set(sampleCode.filter((s) => test(s.text)).map((s) => s.sample))].sort();

  // Members that also have an ObjectSet overload, per the mapping
  const objectSetOverloads = new Set(Object.values(exceptions).filter((e) => /ObjectSet/.test(e.args)).map((e) => e.member));
  const methods = {};
  for (const m of contract.methods) {
    const ex = exceptions[m.name];
    let owner = 'StpRecognizer';
    let member;
    let args = '';
    if (ex) {
      ({ owner, member, args } = ex);
    } else if (declaredNet.has(m.name + 'Async')) {
      member = m.name + 'Async';
    } else if (declaredNet.has(m.name)) {
      member = m.name;
    }
    if (!member || !declaredNet.has(member)) {
      methods[m.name] = { sdk: [], samples: [] };
      continue;
    }
    // The *FromObjectSet overloads share their name with the text-content call: tell the two apart by the type of
    // the first argument (a variable declared as ObjectSet, or a new ObjectSet)
    const wantsObjectSet = /ObjectSet/.test(args);
    const shared = !wantsObjectSet && objectSetOverloads.has(member);
    const shows = (t) => {
      if (owner !== 'StpRecognizer') return new RegExp(`\\b${owner}\\b`).test(t) && new RegExp(`\\.${member}\\s*\\(`).test(t);
      const firstArgs = [...t.matchAll(new RegExp(`\\.${member}\\s*\\(\\s*([^,)]*)`, 'g'))].map((c) => c[1].trim());
      if (!firstArgs.length) return false;
      if (!wantsObjectSet && !shared) return true;
      const isObjectSet = (a) => /^new\s+ObjectSet\b/.test(a) || (/^\w+$/.test(a) && new RegExp(`\\bObjectSet\\s+${a}\\b`).test(t));
      return firstArgs.some((a) => isObjectSet(a) === wantsObjectSet);
    };
    methods[m.name] = {
      sdk: [`${owner === 'StpRecognizer' ? '' : owner + '.'}${member}${args}`],
      samples: used(shows),
    };
  }
  const events = {};
  for (const e of contract['x-stpEvents']) {
    const names = ['On' + e.name, 'On' + e.name + 'Ext'].filter((n) => declaredNet.has(n));
    events[e.name] = {
      sdk: names,
      samples: names.length ? used((t) => new RegExp(`\\b(?:${names.join('|')})\\s*\\+=`).test(t)) : [],
    };
  }
  const git = (...a) => {
    try {
      return execFileSync('git', ['-C', netRoot, ...a], { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  };
  return {
    repo: 'hyssostech/sketch-thru-plan-sdk-net',
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    commit: git('rev-parse', 'HEAD'),
    mapping: 'docs/articles/contract-name-mapping.md',
    methods,
    events,
  };
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

// Without .NET data (no samples/parity-net.json) the table has the JS columns only
const table = (kind) => [
  net
    ? `| Contract ${kind} | JS SDK | JS sample | .NET SDK | .NET sample | Note |\n|---|---|---|---|---|---|`
    : `| Contract ${kind} | JS SDK | JS sample | Note |\n|---|---|---|---|`,
  ...rows.filter((r) => r.kind === kind).map((r) => net
    ? `| ${r.contract} | \`${r.js}\` | ${r.shown} | ${r.netSdk} | ${r.netShown} | ${r.note} |`
    : `| ${r.contract} | \`${r.js}\` | ${r.shown} | ${r.note} |`),
].join('\n');
const none = rows.filter((r) => r.shown === '**none**');
const netNone = net ? rows.filter((r) => r.netShown === NET_PENDING) : [];
const netSource = net
  ? `The .NET columns are taken from [${net.repo}](https://github.com/${net.repo}), branch \`${net.branch}\` at commit
\`${net.commit.slice(0, 12)}\` (\`samples/parity-net.json\`; refresh with \`--net <clone>\`). The .NET names follow that
branch's \`${net.mapping}\`; a .NET sample is listed when its code calls the method or subscribes to the event.
"${NET_PENDING}" marks an item no .NET sample shows yet; "-" in the .NET SDK column means the .NET SDK has no member
for it at that commit.`
  : 'JS columns only: there is no .NET data (samples/parity-net.json is missing; run with `--net <clone>`).';
const md = `# STP contract parity: methods and events in the JS and .NET SDKs and their samples

Generated by \`node scripts/sample-parity.mjs\` from \`json-api/sketch-thru-plan-api.json\` (contract
${contract.info.version}) and the built SDK types - do not edit by hand. "Shown in" lists the samples whose code calls
the method or assigns the handler; "via" means a sample uses a higher-level SDK call that sends it.

${netSource}

${contract.methods.length} methods and ${contract['x-stpEvents'].length} events; ${none.length} are shown in no JS sample${net ? `,
${netNone.length} in no .NET sample` : ''}.

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
  console.log(`wrote samples/PARITY.md: ${rows.length} rows, ${none.length} in no JS sample` +
    (net ? `, ${netNone.length} in no .NET sample` : ' (JS columns only: no .NET data)'));
}
