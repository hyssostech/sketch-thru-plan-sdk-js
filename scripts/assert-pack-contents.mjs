#!/usr/bin/env node
/*
 * STP-708 - assert the packed tarball contains EXACTLY the expected file set.
 *
 * The SBOM is built from the tarball, which makes the SBOM describe the
 * shipped thing by construction - but it also means the SBOM inherits whatever
 * the tarball got wrong. This is the gate on the tarball itself.
 *
 * The comparison is a SET comparison in BOTH directions. Asserting only that
 * the expected files are present would miss a file that appeared, and
 * asserting only a count would miss a swap. Both failures happened for real in
 * this repository's sibling effort within a day of this being written: a pack
 * surface silently lost 18 doc files, and the fix for that silently dropped
 * CHANGELOG.md while every "is the thing I am looking for present?" check
 * stayed green.
 *
 * A difference in either direction is a finding, not a threshold to relax.
 *
 * Usage:
 *   node scripts/assert-pack-contents.mjs --extracted <dir> --expected <json>
 *
 * <dir> is where the tarball was extracted; npm tarballs root everything at
 * "package/", and paths are reported relative to that root.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = 'true';
      else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
for (const r of ['extracted', 'expected']) {
  if (!args[r]) {
    console.error(`usage error: --${r} is required`);
    process.exit(2);
  }
}

const pkgRoot = join(args.extracted, 'package');

let expected;
try {
  expected = JSON.parse(readFileSync(args.expected, 'utf8'));
} catch (err) {
  console.error(`PACK ASSERT FAIL: cannot read ${args.expected}: ${err.message}`);
  process.exit(1);
}

const expectedFiles = expected.packedFiles;
if (!Array.isArray(expectedFiles) || expectedFiles.length === 0) {
  console.error(`PACK ASSERT FAIL: ${args.expected} declares no packedFiles`);
  process.exit(1);
}

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    console.error(`PACK ASSERT FAIL: cannot read ${dir}: ${err.message}`);
    process.exit(1);
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(relative(pkgRoot, full).split(sep).join('/'));
  }
  return out;
}

const actual = walk(pkgRoot).sort();
const want = [...expectedFiles].sort();

const missing = want.filter((f) => !actual.includes(f));
const unexpected = actual.filter((f) => !want.includes(f));

console.log(`Packed file set for ${pkgRoot}`);
console.log(`  expected: ${want.length} file(s)`);
console.log(`  actual:   ${actual.length} file(s)`);
for (const f of actual) {
  const mark = want.includes(f) ? ' ' : '+';
  console.log(`   ${mark} ${f}`);
}
for (const f of missing) {
  console.log(`   - ${f}`);
}

if (missing.length === 0 && unexpected.length === 0) {
  console.log('');
  console.log(`PASS: the packed set is exactly the ${want.length} expected file(s).`);
  process.exit(0);
}

console.error('');
console.error('PACK ASSERT FAIL: the published surface of this package changed.');
if (missing.length > 0) {
  console.error(`  ${missing.length} expected file(s) MISSING from the tarball:`);
  for (const f of missing) console.error(`    - ${f}`);
}
if (unexpected.length > 0) {
  console.error(`  ${unexpected.length} UNEXPECTED file(s) in the tarball:`);
  for (const f of unexpected) console.error(`    + ${f}`);
}
console.error('');
console.error('This is a finding, not a threshold. Something altered what npm packs -');
console.error('a change to "files", to an ignore rule, or to the repository layout.');
console.error(`If the new surface is intended, update packedFiles in ${args.expected}`);
console.error('in the same change, so it is visible in review.');
process.exit(1);
