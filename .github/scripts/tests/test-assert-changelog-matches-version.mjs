#!/usr/bin/env node
/*
 * Controls for assert-changelog-matches-version.mjs.
 *
 * Asserts on the MESSAGE and on a non-zero examined count, not just on exit
 * status: a checker that walked no packages and exited non-zero is broken, not
 * strict, and it would look identical to a working one in a CI log.
 *
 * Run: node .github/scripts/tests/test-assert-changelog-matches-version.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, '..', 'assert-changelog-matches-version.mjs');

let failures = 0;
const tmp = mkdtempSync(join(tmpdir(), 'changelogver-'));

/** pkgs: [{dir, name, version, private?, changelog?}] */
function repo(scenarioName, pkgs) {
  const base = join(tmp, scenarioName);
  for (const p of pkgs) {
    const dir = p.dir ? join(base, p.dir) : base;
    mkdirSync(dir, { recursive: true });
    const manifest = { name: p.name, version: p.version };
    if (p.private) manifest.private = true;
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, null, 2));
    if (p.changelog !== undefined) writeFileSync(join(dir, 'CHANGELOG.md'), p.changelog);
  }
  mkdirSync(base, { recursive: true });
  return base;
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

  const examined = /Examined (\d+) publishable/.exec(out);
  const measured = examined && Number(examined[1]) > 0;
  const missing = mustMention.filter((m) => !out.toLowerCase().includes(m.toLowerCase()));

  if (!ok || !measured || missing.length) {
    failures += 1;
    console.log(`  WRONG  ${label}`);
    if (!ok) console.log(`         expected ${expectPass ? 'PASS' : 'FAIL'}, got ${passed ? 'PASS' : 'FAIL'} (exit ${code})`);
    if (!measured) console.log('         examined ZERO publishable packages - it measured nothing');
    for (const m of missing) console.log(`         expected the output to mention: ${m}`);
    console.log(out.split('\n').map((l) => `         ${l}`).join('\n'));
  } else {
    console.log(`  OK     ${label}`);
  }
}

const CL = (h, rest = '\n- something\n\n## Version 0.0.1\n- older\n') =>
  `# Plugin Change Log\n\n## Version ${h}${rest}`;

console.log('=== the live drift on main, reconstructed ===');

check(
  'azurespeech: package 0.3.4, changelog 0.3.2 must FAIL',
  repo('azure-drift', [
    { name: 'root', version: '0.6.15', private: true },
    { dir: 'plugins/azure', name: '@hyssostech/azurespeech-plugin', version: '0.3.4', changelog: CL('0.3.2') },
  ]),
  false,
  ['tops out at 0.3.2', 'azurespeech-plugin is version 0.3.4', 'ships inside the published tarball']
);

check(
  'awsspeech: package 0.1.1, changelog 0.1.0 must FAIL',
  repo('aws-drift', [
    { name: 'root', version: '0.6.15', private: true },
    { dir: 'plugins/aws', name: '@hyssostech/awsspeech-plugin', version: '0.1.1', changelog: CL('0.1.0') },
  ]),
  false,
  ['tops out at 0.1.0']
);

console.log('');
console.log('=== scope: what this check deliberately does NOT object to ===');

check(
  'a PRIVATE package with a lagging changelog must PASS - it ships to nobody',
  repo('private-lag', [
    { name: 'root', version: '0.6.15', changelog: CL('0.6.15') },
    { dir: 'samples/x', name: 'sample', version: '9.9.9', private: true, changelog: CL('0.0.1') },
  ]),
  true,
  ['PASS']
);

check(
  'a published package with NO changelog must PASS - requiring one is a process decision',
  repo('no-changelog', [
    { name: 'root', version: '0.6.15', changelog: CL('0.6.15') },
    { dir: 'plugins/leaflet', name: '@hyssostech/leaflet-plugin', version: '0.1.1' },
  ]),
  true,
  ['PASS']
);

console.log('');
console.log('=== heading forms actually used in this repository ===');

check(
  '"## Version 0.6.15" must PASS',
  repo('form-version', [{ name: 'root', version: '0.6.15', changelog: CL('0.6.15') }]),
  true,
  ['PASS']
);

check(
  '"## 0.6.15" without the word Version must PASS too',
  repo('form-bare', [
    { name: 'root', version: '0.6.15', changelog: '# Log\n\n## 0.6.15\n- a thing\n' },
  ]),
  true,
  ['PASS']
);

check(
  'a pre-release documented under its release base must PASS',
  repo('rc-base', [{ name: 'root', version: '0.7.0-alpha.0', changelog: CL('0.7.0') }]),
  true,
  ['PASS']
);

console.log('');
console.log('=== the placeholder that hides drift ===');

check(
  'an "## Unreleased" heading above a real version must FAIL, not silently skip to it',
  repo('placeholder', [
    {
      name: 'root',
      version: '0.6.15',
      changelog: '# Log\n\n## Unreleased\n- pending\n\n## Version 0.6.15\n- shipped\n',
    },
  ]),
  false,
  ['not a version', 'Unreleased']
);

console.log('');
console.log('=== malformed input is not a pass ===');

check(
  'an unparseable package.json must FAIL',
  (() => {
    const d = repo('bad-json', [{ name: 'root', version: '0.6.15', changelog: CL('0.6.15') }]);
    mkdirSync(join(d, 'plugins', 'x'), { recursive: true });
    writeFileSync(join(d, 'plugins', 'x', 'package.json'), '{not json');
    return d;
  })(),
  false,
  ['unparseable']
);

console.log('');
console.log('=== a check that examined nothing must not report health ===');
{
  const empty = join(tmp, 'no-packages');
  mkdirSync(empty, { recursive: true });
  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, [CHECKER, empty], { encoding: 'utf8' });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
    code = e.status ?? 1;
  }
  if (code === 0 || !/measured NOTHING/i.test(out)) {
    failures += 1;
    console.log('  WRONG  a tree with no publishable package must fail loudly');
    console.log(out.split('\n').map((l) => `         ${l}`).join('\n'));
  } else {
    console.log('  OK     a tree with no publishable package fails loudly, not silently');
  }
}

rmSync(tmp, { recursive: true, force: true });

console.log('');
if (failures > 0) {
  console.log(`${failures} control(s) did not behave as required.`);
  process.exit(1);
}
console.log('All controls behaved as required: a lagging changelog on a published package');
console.log('fails, private packages and packages without a changelog are left alone, and');
console.log('both heading forms used in this repository are accepted.');
