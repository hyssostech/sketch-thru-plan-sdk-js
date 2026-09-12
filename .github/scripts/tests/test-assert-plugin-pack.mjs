#!/usr/bin/env node
/*
 * Unit tests for assert-plugin-pack.mjs.
 *
 * Pattern borrowed from the engine's test-sonar-quality-gate.sh (STP-741/
 * PR #86): drive the judge with SYNTHETIC payloads so every failure mode is
 * proven without npm, without a real package, and without publishing anything.
 *
 * The first case is the real one. `bad()` reproduces exactly what
 * @hyssostech/arcgis-plugin@0.1.2 shipped to npm on 2026-09-11 - and the test
 * asserts the gate would have refused it. That is the regression test for the
 * incident, not a hypothetical.
 *
 * Run: node .github/scripts/tests/test-assert-plugin-pack.mjs
 */

import { evaluate } from '../assert-plugin-pack.mjs';

let failures = 0;

function pack(name, version, paths) {
  return { name, version, files: paths.map((p) => ({ path: p, size: 1 })) };
}

function check(label, manifest, packed, expectPass, mustMention = []) {
  const { problems } = evaluate(manifest, packed);
  const passed = problems.length === 0;
  const ok = passed === expectPass;

  const missing = mustMention.filter(
    (m) => !problems.some((p) => p.toLowerCase().includes(m.toLowerCase())),
  );

  if (!ok || missing.length > 0) {
    failures += 1;
    console.log(`  WRONG  ${label}`);
    console.log(`         expected ${expectPass ? 'PASS' : 'FAIL'}, got ${passed ? 'PASS' : 'FAIL'}`);
    for (const m of missing) console.log(`         expected a problem mentioning: ${m}`);
    for (const p of problems) console.log(`         problem: ${p.slice(0, 100)}`);
  } else {
    console.log(`  OK     ${label}${passed ? '' : `  (${problems.length} problem(s))`}`);
  }
}

console.log('=== the incident itself ===');
// Verbatim shape of what arcgis-plugin@0.1.2 actually shipped.
check(
  'arcgis 0.1.2 as published - source, config and a stale self-tarball, no dist',
  { name: '@hyssostech/arcgis-plugin', version: '0.1.2' },
  pack('@hyssostech/arcgis-plugin', '0.1.2', [
    'rollup.config.js', 'package.json', 'tsconfig.json', 'README.md',
    'hyssostech-arcgis-plugin-0.1.0.tgz', 'src/arcgis.ts',
  ]),
  false,
  ['ships NO dist/', 'nested tarball', 'no "files" array'],
);

check(
  'arcgis 0.1.3 as fixed - dist present, files declared, no self-tarball',
  { name: '@hyssostech/arcgis-plugin', version: '0.1.3', files: ['dist', 'src', 'README.md'] },
  pack('@hyssostech/arcgis-plugin', '0.1.3', [
    'README.md', 'package.json', 'src/arcgis.ts',
    'dist/arcgis-bundle.js', 'dist/arcgis-bundle.d.ts',
    'dist/arcgis-bundle.esm.js', 'dist/arcgis-bundle-min.js',
  ]),
  true,
);

console.log('');
console.log('=== each failure mode in isolation ===');

check(
  'no dist/ shipped',
  { name: 'p', version: '1.0.0', files: ['src'] },
  pack('p', '1.0.0', ['package.json', 'src/index.ts']),
  false,
  ['ships NO dist/'],
);

check(
  'main points at a file not in the tarball',
  { name: 'p', version: '1.0.0', files: ['dist'], main: 'dist/index.js' },
  pack('p', '1.0.0', ['package.json', 'dist/other.js']),
  false,
  ['"main" points at dist/index.js'],
);

check(
  'types points at a missing file',
  { name: 'p', version: '1.0.0', files: ['dist'], types: './dist/index.d.ts' },
  pack('p', '1.0.0', ['package.json', 'dist/index.js']),
  false,
  ['"types" points at dist/index.d.ts'],
);

check(
  'ships a nested tarball',
  { name: 'p', version: '1.0.0', files: ['dist'] },
  pack('p', '1.0.0', ['package.json', 'dist/index.js', 'p-0.9.0.tgz']),
  false,
  ['nested tarball'],
);

check(
  'no files array - the condition that caused the incident',
  { name: 'p', version: '1.0.0' },
  pack('p', '1.0.0', ['package.json', 'dist/index.js']),
  false,
  ['no "files" array'],
);

check(
  'empty files array counts as absent',
  { name: 'p', version: '1.0.0', files: [] },
  pack('p', '1.0.0', ['package.json', 'dist/index.js']),
  false,
  ['no "files" array'],
);

console.log('');
console.log('=== controls: these must PASS, or the gate is over-eager ===');

check(
  'healthy package with entry points that resolve',
  {
    name: 'p', version: '1.0.0', files: ['dist', 'src'],
    main: 'dist/b-min.js', module: 'dist/b.esm.js', types: 'dist/b.d.ts',
  },
  pack('p', '1.0.0', [
    'package.json', 'README.md', 'src/i.ts',
    'dist/b-min.js', 'dist/b.esm.js', 'dist/b.d.ts',
  ]),
  true,
);

check(
  'no entry points declared at all is fine, as long as dist ships',
  { name: 'p', version: '1.0.0', files: ['dist', 'src', 'README.md'] },
  pack('p', '1.0.0', ['package.json', 'README.md', 'src/i.ts', 'dist/b.js']),
  true,
);

check(
  'a bare "dist" entry (directory form) counts as dist',
  { name: 'p', version: '1.0.0', files: ['dist'] },
  pack('p', '1.0.0', ['package.json', 'dist']),
  true,
);

console.log('');
if (failures > 0) {
  console.error(`FAILED: ${failures} case(s) did not behave as specified.`);
  process.exit(1);
}
console.log('All cases behaved as specified.');
