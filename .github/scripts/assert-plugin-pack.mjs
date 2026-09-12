#!/usr/bin/env node
/*
 * STP-742 - assert a plugin's tarball contains the code it claims to ship.
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
 * STRUCTURE, borrowed from the engine's sonar-quality-gate.sh (STP-741/PR #86):
 * the judging is a pure function over a payload, separate from the code that
 * obtains it. That is what lets the failure modes be proven by unit test
 * instead of by breaking a real package and watching a real publish. A gate
 * whose only proof of failing is a manual one-off is a gate nobody re-proves.
 *
 * Usage:
 *   assert-plugin-pack.mjs <workspace-dir>     # runs npm pack --dry-run
 *   assert-plugin-pack.mjs --payload <file>    # {manifest, packed} fixture
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The judge. Pure: manifest + packed -> list of problems.
 * Exported so the tests can drive it without npm or a real package.
 */
export function evaluate(manifest, packed) {
  const files = (packed.files || []).map((f) => f.path);
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

  return { problems, files, dist };
}

function report(manifest, packed) {
  const { problems, files, dist } = evaluate(manifest, packed);

  console.log(`${packed.name}@${packed.version}: ${files.length} files, ${dist.length} under dist/`);
  for (const f of files) console.log(`    ${f}`);

  if (problems.length > 0) {
    console.error('');
    console.error(`PLUGIN PACK FAIL: ${packed.name}@${packed.version}`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('');
    console.error('Refusing to publish a package that does not contain its own code.');
    return 1;
  }

  console.log(`PASS: ${packed.name}@${packed.version} ships its built output.`);
  return 0;
}

function main(argv) {
  if (argv[0] === '--payload') {
    // Test path: a fixture carrying both halves, so every failure mode is
    // reachable without npm and without a broken real package.
    const fixture = JSON.parse(readFileSync(argv[1], 'utf8'));
    return report(fixture.manifest, fixture.packed);
  }

  const ws = argv[0];
  if (!ws) {
    console.error('usage: assert-plugin-pack.mjs <workspace-dir> | --payload <file>');
    return 2;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(ws, 'package.json'), 'utf8'));
  } catch (err) {
    console.error(`PLUGIN PACK FAIL: cannot read ${ws}/package.json: ${err.message}`);
    return 1;
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
    return 1;
  }

  return report(manifest, packed);
}

// Only run when invoked directly, so the tests can import evaluate().
//
// Compare resolved paths, NOT a filename suffix. `endsWith('assert-plugin-pack.mjs')`
// also matches `test-assert-plugin-pack.mjs`, so importing the module from its
// own test ran main() with the test runner's argv and exited 2 before a single
// case executed. A guard that matches more than it names is the same defect
// class this script exists to catch.
if (process.argv[1] &&
    resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
