#!/usr/bin/env node
/*
 * STP-698 / STP-700 parity. A changelog that does not describe the version it
 * ships beside.
 *
 * The .NET sibling had the same defect and it shipped: 0.6.0-rc.1 went to
 * nuget.org while every document still said 0.5.0. Here it is smaller and
 * quieter, because it is in the plugins rather than the SDK - measured on main
 * when this was written:
 *
 *   @hyssostech/awsspeech-plugin    published 0.1.1, CHANGELOG topped at 0.1.0
 *   @hyssostech/azurespeech-plugin  published 0.3.4, CHANGELOG topped at 0.3.2
 *
 * Both are on npm at those versions, and both ship their CHANGELOG.md inside
 * the tarball, so a consumer reading the changelog for the version they
 * installed finds no mention of it.
 *
 * SCOPE, and why it is drawn here
 *
 * Only PUBLISHED packages - `private: true` is skipped, because an unpublished
 * sample's version number means nothing to anyone.
 *
 * Only packages that HAVE a CHANGELOG.md. Four published plugins have none at
 * all, which is arguably worse than one that lags; but requiring a changelog is
 * a process decision for the repository owner, and a gate that invents process
 * is a gate that gets disabled. This one enforces something narrower and
 * unarguable: a changelog that exists must not lie.
 *
 * Usage: node .github/scripts/assert-changelog-matches-version.mjs [root]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';

const root = process.argv[2] ?? '.';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, out);
    } else if (entry === 'package.json') {
      out.push(full);
    }
  }
  return out;
}

// "## Version 0.3.4" and "## 0.3.4" are both in use in this repository.
const HEADING = /^##(?!#)\s+(?:Version\s+)?(\d[^\s]*)/;
const ANY_HEADING = /^##(?!#)\s+(.*?)\s*$/;

// Everything before a pre-release or build-metadata separator.
const releaseBase = (v) => v.split(/[-+]/)[0];

const manifests = walk(root);
const problems = [];
const pairs = [];
let published = 0;

for (const manifest of manifests) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  } catch (e) {
    problems.push(`${relative(root, manifest).split(sep).join('/')}: unparseable - ${e.message}`);
    continue;
  }

  if (pkg.private === true) continue;
  if (!pkg.version) continue;
  published += 1;

  const changelog = join(dirname(manifest), 'CHANGELOG.md');
  if (!existsSync(changelog)) continue;

  const shown = relative(root, changelog).split(sep).join('/');
  const lines = readFileSync(changelog, 'utf8').split(/\r?\n/);

  // The TOP heading, not the first one that happens to parse as a version: a
  // placeholder sitting above a real version would otherwise be skipped and the
  // stale entry below it reported as though it were current.
  let topLine = 0;
  let topText = null;
  for (let i = 0; i < lines.length; i += 1) {
    const m = ANY_HEADING.exec(lines[i]);
    if (m) {
      topText = m[1];
      topLine = i + 1;
      break;
    }
  }

  if (topText === null) {
    problems.push(`${shown}: no "##" section heading at all.`);
    continue;
  }

  const parsed = HEADING.exec(`## ${topText}`);
  if (!parsed) {
    problems.push(
      `${shown}:${topLine}: the top section is "${topText}", which is not a version.\n` +
        '        A placeholder is always correct, so it never forces anyone to look.'
    );
    continue;
  }

  const top = parsed[1];
  pairs.push({ name: pkg.name, version: pkg.version, changelog: shown, top });

  if (top !== pkg.version && top !== releaseBase(pkg.version)) {
    problems.push(
      `${shown}:${topLine}: tops out at ${top}, but ${pkg.name} is version ${pkg.version}.\n` +
        `        CHANGELOG.md ships inside the published tarball, so a consumer on\n` +
        `        ${pkg.version} reads a changelog that does not mention it.`
    );
  }
}

// A run that found no published packages examined nothing, whichever way it
// would have exited.
if (published === 0) {
  console.error(
    `Found ${manifests.length} package.json file(s) under ${root} but not one ` +
      'publishable package. This check measured NOTHING.'
  );
  process.exit(1);
}

console.log(`Examined ${published} publishable package(s), ${pairs.length} with a CHANGELOG.`);
for (const p of pairs) {
  const mark = p.top === p.version || p.top === releaseBase(p.version) ? ' ' : '!';
  console.log(`  ${mark} ${p.name.padEnd(34)} ${p.version.padEnd(12)} ${p.changelog} -> ${p.top}`);
}

if (problems.length > 0) {
  console.error('');
  console.error('Changelogs that do not describe the version they ship with:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log('');
console.log('PASS: every changelog names the version of the package it sits beside.');
