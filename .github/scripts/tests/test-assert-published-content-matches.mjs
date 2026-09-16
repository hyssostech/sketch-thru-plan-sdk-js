#!/usr/bin/env node
/*
 * Controls for assert-published-content-matches.mjs.
 *
 * Two things are being proven, and they need different treatment:
 *
 *   1. THE COMPARISON. Driven offline through --published-manifest, so every
 *      branch runs without a network. A control that needs npm to be reachable
 *      is a control that stops running the day it is not, which is the same
 *      class of silence the checker exists to break.
 *
 *   2. THE TAR READER. The risky half - a hand-rolled ustar walk. It gets its
 *      own controls against tarballs built HERE, including the two shapes that
 *      actually bite: an octal size field with space/NUL padding, and a long
 *      name stored in a preceding 'L' entry.
 *
 * Run: node .github/scripts/tests/test-assert-published-content-matches.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECKER = join(HERE, '..', 'assert-published-content-matches.mjs');

let failures = 0;
const tmp = mkdtempSync(join(tmpdir(), 'pubcontent-'));

function manifest(nameOnDisk, body) {
  const p = join(tmp, `${nameOnDisk}.json`);
  writeFileSync(p, JSON.stringify(body, null, 2));
  return p;
}

function check(label, args, expectPass, mustMention = []) {
  let out = '';
  let code = 0;
  try {
    out = execFileSync(process.execPath, [CHECKER, ...args], { encoding: 'utf8' });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
    code = e.status ?? 1;
  }
  const passed = code === 0;
  const ok = passed === expectPass;
  const missing = mustMention.filter((m) => !out.toLowerCase().includes(m.toLowerCase()));

  if (!ok || missing.length) {
    failures += 1;
    console.log(`  WRONG  ${label}`);
    if (!ok) console.log(`         expected ${expectPass ? 'PASS' : 'FAIL'}, got ${passed ? 'PASS' : 'FAIL'} (exit ${code})`);
    for (const m of missing) console.log(`         expected the output to mention: ${m}`);
    console.log(out.split('\n').map((l) => `         ${l}`).join('\n'));
  } else {
    console.log(`  OK     ${label}`);
  }
}

/* ---------------------------------------------------------------- the comparison */

const PUBLISHED_AWS = manifest('published-aws', {
  name: '@hyssostech/awsspeech-plugin',
  version: '0.1.1',
  dependencies: { '@aws-sdk/client-transcribe-streaming': '^3.998.0' },
  main: 'dist/index.js',
});

console.log('=== the real case, reconstructed from what npm was actually serving ===');

check(
  'a runtime dependency changed under a published version must FAIL',
  [
    '@hyssostech/awsspeech-plugin',
    '0.1.1',
    manifest('local-aws-drifted', {
      name: '@hyssostech/awsspeech-plugin',
      version: '0.1.1',
      dependencies: { '@aws-sdk/client-transcribe-streaming': '^3.1130.0' },
      main: 'dist/index.js',
    }),
    '--published-manifest',
    PUBLISHED_AWS,
  ],
  false,
  ['dependencies', '^3.998.0', '^3.1130.0', 'Bump the', 'did not change in this release']
);

check(
  'a NEW files array under a published version must FAIL - it changes the tarball',
  [
    '@hyssostech/awsspeech-plugin',
    '0.1.1',
    manifest('local-aws-files', {
      name: '@hyssostech/awsspeech-plugin',
      version: '0.1.1',
      dependencies: { '@aws-sdk/client-transcribe-streaming': '^3.998.0' },
      main: 'dist/index.js',
      files: ['dist', 'src', 'README.md'],
    }),
    '--published-manifest',
    PUBLISHED_AWS,
  ],
  false,
  ['files']
);

console.log('');
console.log('=== what must NOT block a release ===');

check(
  'identical consumer-facing content must PASS - skipping it really is correct',
  [
    '@hyssostech/awsspeech-plugin',
    '0.1.1',
    manifest('local-aws-same', {
      name: '@hyssostech/awsspeech-plugin',
      version: '0.1.1',
      dependencies: { '@aws-sdk/client-transcribe-streaming': '^3.998.0' },
      main: 'dist/index.js',
    }),
    '--published-manifest',
    PUBLISHED_AWS,
  ],
  true,
  ['matches what npm serves']
);

check(
  'a devDependency bump must PASS - it changes nothing a consumer installs',
  [
    '@hyssostech/awsspeech-plugin',
    '0.1.1',
    manifest('local-aws-devdep', {
      name: '@hyssostech/awsspeech-plugin',
      version: '0.1.1',
      dependencies: { '@aws-sdk/client-transcribe-streaming': '^3.998.0' },
      main: 'dist/index.js',
      devDependencies: { rollup: '^99.0.0', typescript: '^9.9.9' },
    }),
    '--published-manifest',
    PUBLISHED_AWS,
  ],
  true,
  ['matches what npm serves']
);

console.log('');
console.log('=== fail closed ===');

check(
  'an unreadable published manifest must FAIL, not be read as "unchanged"',
  [
    '@hyssostech/awsspeech-plugin',
    '0.1.1',
    PUBLISHED_AWS,
    '--published-manifest',
    join(tmp, 'does-not-exist.json'),
  ],
  false,
  ['could not read']
);

check(
  'an unreadable LOCAL manifest must FAIL',
  ['@hyssostech/awsspeech-plugin', '0.1.1', join(tmp, 'no-such-local.json'), '--published-manifest', PUBLISHED_AWS],
  false,
  ['could not read']
);

console.log('');
console.log('=== missing arguments are a usage error, not a pass ===');
{
  let code = 0;
  try {
    execFileSync(process.execPath, [CHECKER], { encoding: 'utf8' });
  } catch (e) {
    code = e.status ?? 1;
  }
  if (code === 0) {
    failures += 1;
    console.log('  WRONG  running with no arguments exited 0');
  } else {
    console.log(`  OK     running with no arguments exits ${code}`);
  }
}

/* ------------------------------------------------------------------ the tar reader */

console.log('');
console.log('=== the hand-rolled tar reader, against archives built here ===');

/** Minimal ustar writer. Only what a control needs, so the reader is what is under test. */
function tarEntry(name, content, typeflag = '0') {
  const data = Buffer.from(content, 'utf8');
  const header = Buffer.alloc(512, 0);
  header.write(name.slice(0, 100), 0, 'utf8');
  header.write('0000644\0', 100, 'utf8');
  header.write('0000000\0', 108, 'utf8');
  header.write('0000000\0', 116, 'utf8');
  // Octal size, NUL-terminated - the padding style that trips a naive parseInt.
  header.write(data.length.toString(8).padStart(11, '0') + '\0', 124, 'utf8');
  header.write('00000000000\0', 136, 'utf8');
  header.write('        ', 148, 'utf8'); // checksum placeholder
  header.write(typeflag, 156, 'utf8');
  header.write('ustar\0', 257, 'utf8');
  header.write('00', 263, 'utf8');
  let sum = 0;
  for (const b of header) sum += b;
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'utf8');

  const pad = Buffer.alloc((512 - (data.length % 512)) % 512, 0);
  return Buffer.concat([header, data, pad]);
}

const tarball = (entries) =>
  gzipSync(Buffer.concat([...entries, Buffer.alloc(1024, 0)]));

// The reader lives in its own module precisely so importing it does not run
// the checker - an earlier version of this control imported the CHECKER and got
// its usage error instead of a function.
const { readFromTgz } = await import(
  pathToFileURL(join(HERE, '..', 'lib', 'read-tgz.mjs')).href
).catch((e) => ({ __error__: e }));

function tarCase(label, gz, wanted, expected) {
  let got;
  try {
    got = readFromTgz(gz, wanted);
  } catch (e) {
    got = `THREW: ${e.message}`;
  }
  if (got === expected) {
    console.log(`  OK     ${label}`);
  } else {
    failures += 1;
    console.log(`  WRONG  ${label}`);
    console.log(`         expected ${JSON.stringify(expected)}`);
    console.log(`         got      ${JSON.stringify(got)}`);
  }
}

if (typeof readFromTgz !== 'function') {
  failures += 1;
  console.log('  WRONG  readFromTgz is not exported - the tar reader cannot be tested at all');
} else {
  const BODY = '{"name":"x","version":"1.0.0"}';

  tarCase(
    'finds package/package.json among several entries',
    tarball([
      tarEntry('package/README.md', '# readme\n'),
      tarEntry('package/package.json', BODY),
      tarEntry('package/dist/index.js', 'console.log(1)\n'),
    ]),
    'package/package.json',
    BODY
  );

  tarCase(
    'returns null rather than throwing when the entry is absent',
    tarball([tarEntry('package/README.md', '# readme\n')]),
    'package/package.json',
    null
  );

  tarCase(
    'skips a preceding entry whose size is not a multiple of 512',
    tarball([
      tarEntry('package/odd.txt', 'x'.repeat(513)),
      tarEntry('package/package.json', BODY),
    ]),
    'package/package.json',
    BODY
  );

  tarCase(
    'handles a long name stored in an L entry',
    tarball([
      tarEntry('././@LongLink', 'package/' + 'a/'.repeat(60) + 'package.json', 'L'),
      tarEntry('package/truncated-name', BODY),
      tarEntry('package/package.json', 'WRONG ONE'),
    ]),
    'package/' + 'a/'.repeat(60) + 'package.json',
    BODY
  );

  tarCase(
    'a zero-length entry does not stall the walk',
    tarball([tarEntry('package/empty', ''), tarEntry('package/package.json', BODY)]),
    'package/package.json',
    BODY
  );
}

rmSync(tmp, { recursive: true, force: true });

console.log('');
if (failures > 0) {
  console.log(`${failures} control(s) did not behave as required.`);
  process.exit(1);
}
console.log('All controls behaved as required: content drift under a published version fails,');
console.log('devDependency churn does not, every unreadable input fails closed, and the tar');
console.log('reader handles padding, absence, long names and empty entries.');
