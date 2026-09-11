#!/usr/bin/env node
/*
 * STP-741 - assert a plugin's tarball contains the code it claims to ship.
 *
 * WHY THIS EXISTS, precisely.
 *
 * On 2026-09-11 the plugins-v1.0.0+sdk0.6.15 tag published
 * @hyssostech/arcgis-plugin 0.1.2 and @hyssostech/googlemaps-plugin 0.1.1 with
 * NO dist/ AT ALL. Both had shipped 16 files including 4 dist entries in their
 * previous release; the new ones shipped 6 and 7 files of TypeScript source,
 * rollup config and tsconfig. arcgis additionally shipped a stale 31 KB
 * tarball of its own 0.1.0 release.
 *
 * Every signal was green. `npm run build` succeeded and wrote dist/. `npm
 * publish` succeeded. The workflow was green. npm printed
 * "+ @hyssostech/arcgis-plugin@0.1.2".
 *
 * The cause: STP-698 untracked and ignored the build output, and those
 * packages declared no "files" array. With no "files" and no .npmignore, npm
 * packlist falls back to the ignore rules - so dist/ was ignored AT PACK TIME
 * even though it existed on disk. Nothing compared what was built to what was
 * packed.
 *
 * This is the same defect the root SDK package is protected from by its own
 * "files" array plus scripts/assert-pack-contents.mjs. The plugins had
 * neither. A "files" array alone is not enough either: it can be wrong, and
 * the fix for the sibling incident silently dropped CHANGELOG.md while every
 * "is the thing I am looking for present?" check stayed green.
 *
 * Usage: node .github/scripts/assert-plugin-pack.mjs <workspace-dir>
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ws = process.argv[2];
if (!ws) {
  console.error('usage: assert-plugin-pack.mjs <workspace-dir>');
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(ws, 'package.json'), 'utf8'));
} catch (err) {
  console.error(`PLUGIN PACK FAIL: cannot read ${ws}/package.json: ${err.message}`);
  process.exit(1);
}

let packed;
try {
  const out = execFileSync(
    'npm',
    ['pack', '--workspace', ws, '--dry-run', '--json'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  );
  packed = JSON.parse(out)[0];
} catch (err) {
  console.error(`PLUGIN PACK FAIL: npm pack failed for ${ws}: ${err.message}`);
  process.exit(1);
}

const files = packed.files.map((f) => f.path);
const problems = [];

// 1. The built output must be in the tarball. This is the check that would
//    have caught the 2026-09-11 regression.
const dist = files.filter((f) => f === 'dist' || f.startsWith('dist/'));
if (dist.length === 0) {
  problems.push(
    'ships NO dist/ - the built output is missing from the tarball. Declare a ' +
    '"files" array; without one npm packlist falls back to ignore rules and ' +
    'silently drops ignored build output.',
  );
}

// 2. Whatever the manifest points consumers at must actually be present.
//    A package whose "main" is not in its own tarball is broken on install.
for (const key of ['main', 'module', 'types', 'typings']) {
  const target = manifest[key];
  if (!target) continue;
  const norm = String(target).replace(/^\.\//, '');
  if (!files.includes(norm)) {
    problems.push(`"${key}" points at ${norm}, which is NOT in the tarball`);
  }
}

// 3. A package must never ship a tarball of itself. arcgis did.
const nested = files.filter((f) => f.endsWith('.tgz'));
if (nested.length > 0) {
  problems.push(`ships nested tarball(s): ${nested.join(', ')}`);
}

// 4. "files" is what makes the surface deliberate rather than incidental.
if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
  problems.push(
    'declares no "files" array, so its published surface is whatever the ' +
    'ignore rules happen to leave behind - the exact condition that caused ' +
    'the regression this script exists to prevent',
  );
}

console.log(`${packed.name}@${packed.version}: ${packed.entryCount} files, ${dist.length} under dist/`);
for (const f of files) console.log(`    ${f}`);

if (problems.length > 0) {
  console.error('');
  console.error(`PLUGIN PACK FAIL: ${packed.name}@${packed.version}`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  console.error('Refusing to publish a package that does not contain its own code.');
  process.exit(1);
}

console.log(`PASS: ${packed.name}@${packed.version} ships its built output.`);
