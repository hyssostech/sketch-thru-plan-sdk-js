#!/usr/bin/env node
/*
 * Controls for assert-no-privileged-install.mjs.
 *
 * The checker's claim is that a job can no longer both hold a publish
 * credential and run third-party install code. A checker only ever observed
 * passing supports no such claim - and while writing these, TWO of my
 * throwaway controls "failed" for reasons that had nothing to do with the
 * checker: once because a shell mangled a path so the fixture was never
 * written, once because the path reached node in a form it could not resolve
 * and the script crashed. Both times a non-zero exit looked exactly like
 * gating.
 *
 * So these assert on the MESSAGE and on a non-zero examined count, not merely
 * on the exit code. A checker that examined zero jobs and exited non-zero is
 * not gating; it is broken.
 *
 * Run: node .github/scripts/tests/test-assert-no-privileged-install.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, '..', 'assert-no-privileged-install.mjs');

let failures = 0;
const tmp = mkdtempSync(join(tmpdir(), 'privinstall-'));

function scenario(name, yaml) {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'wf.yml'), yaml);
  return dir;
}

function check(label, dir, expectPass, mustMention = []) {
  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, [CHECKER, dir], { encoding: 'utf8' });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
    code = e.status ?? 1;
  }
  const passed = code === 0;
  const ok = passed === expectPass;

  // A run that examined nothing proves nothing, whichever way it exited.
  const examined = /Examined (\d+) job/.exec(out);
  const measured = examined && Number(examined[1]) > 0;

  const missing = mustMention.filter((m) => !out.toLowerCase().includes(m.toLowerCase()));

  if (!ok || !measured || missing.length) {
    failures += 1;
    console.log(`  WRONG  ${label}`);
    if (!ok) console.log(`         expected ${expectPass ? 'PASS' : 'FAIL'}, got ${passed ? 'PASS' : 'FAIL'} (exit ${code})`);
    if (!measured) console.log('         examined ZERO jobs - it measured nothing, so this result is meaningless');
    for (const m of missing) console.log(`         expected the message to mention: ${m}`);
    console.log(out.split('\n').map((l) => `         ${l}`).join('\n'));
  } else {
    console.log(`  OK     ${label}`);
  }
}

const PRIVILEGED_INSTALL = `name: t
on:
  push:
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Install
        run: npm ci
      - name: Publish
        run: npm publish
`;

console.log('=== the shape this exists to prevent ===');
check(
  'id-token + npm ci in one job must FAIL',
  scenario('together', PRIVILEGED_INSTALL),
  false,
  ['job "publish"', 'id-token: write', 'must not run while a credential'],
);

console.log('');
console.log('=== inherited privilege is the easy one to miss ===');
check(
  'a workflow-level id-token default must still be caught',
  scenario('inherited', `name: t
on:
  push:
permissions:
  id-token: write
jobs:
  p:
    runs-on: ubuntu-latest
    steps:
      - name: Install
        run: npm ci
`),
  false,
  ['INHERITED'],
);

console.log('');
console.log('=== other privileged tokens count too, not just id-token ===');
check(
  'contents: write + an install must FAIL',
  scenario('contents', `name: t
on:
  push:
jobs:
  p:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Install
        run: yarn install
`),
  false,
  ['contents: write'],
);

console.log('');
console.log('=== and the counter-cases, which is where a blunt rule would die ===');
check(
  'the split shape must PASS',
  scenario('split', `name: t
on:
  push:
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Install
        run: npm ci
  publish:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Publish
        run: npm publish pkg.tgz
`),
  true,
  ['PASS'],
);

check(
  '--ignore-scripts is the mitigation, so it must be ALLOWED even when privileged',
  scenario('ignorescripts', `name: t
on:
  push:
jobs:
  p:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - name: Install
        run: npm ci --ignore-scripts
`),
  true,
  ['PASS'],
);

check(
  'an unprivileged job may install freely',
  scenario('unprivileged', `name: t
on:
  push:
jobs:
  p:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Install
        run: npm ci
`),
  true,
  ['PASS'],
);

rmSync(tmp, { recursive: true, force: true });

console.log('');
if (failures > 0) {
  console.log(`${failures} control(s) did not behave as required.`);
  process.exit(1);
}
console.log('All controls behaved as required: privileged installs are rejected, inherited');
console.log('privilege is caught, and the split and --ignore-scripts shapes are accepted.');
