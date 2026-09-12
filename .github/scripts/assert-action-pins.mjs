#!/usr/bin/env node
/*
 * STP-728 - every third-party action reference must be pinned to a commit SHA.
 *
 * WHY.
 *
 * STP-707 SHA-pinned every action in both SDK repos. Its acceptance criterion
 * was a grep a human runs. No workflow ran it, so a future `uses: foo@v1`
 * would merge green and the convention would decay silently.
 *
 * The readable half already had drifted: main carried
 * `actions/checkout@3d3c42e5... # v4` on a SHA that is actually v7.0.1 - a
 * version comment wrong by THREE MAJOR VERSIONS. The pin was correct; the
 * comment was decoration nobody re-derived.
 *
 * TWO TRAPS INHERITED FROM THIS EPIC, both of which produced false PASSES
 * during STP-707 and are the reason this is a script rather than a one-liner:
 *
 *   1. A negative lookahead is not available. `rg "uses: [^@]+@(?![0-9a-f]{40})"`
 *      exits 2 with empty stdout because ripgrep has no look-around - which
 *      reads exactly like "nothing unpinned found". Match positively, then
 *      classify.
 *   2. A gate whose success is silent is not evidence. This reports how many
 *      refs it EXAMINED, and fails if that number is zero, so "scanned nothing"
 *      cannot masquerade as "found nothing wrong".
 *
 * Structure follows assert-plugin-pack.mjs and the engine's
 * sonar-quality-gate.sh: the judging is a pure function over parsed input, so
 * every failure mode is unit-testable without a repository.
 *
 * Usage:
 *   assert-action-pins.mjs [dir]          # default .github/workflows
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA40 = /^[0-9a-f]{40}$/;

/**
 * Parse `uses:` references out of workflow text.
 * Returns { file, line, raw, spec, ref, comment } per reference.
 */
export function parseUses(file, text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    // Positive match. Deliberately NOT a lookahead - see the header.
    const m = line.match(/^\s*(?:-\s*)?uses:\s*(\S+)\s*(?:#\s*(.*))?$/);
    if (!m) return;
    const spec = m[1];
    const comment = (m[2] || '').trim();
    const at = spec.lastIndexOf('@');
    out.push({
      file,
      line: i + 1,
      raw: line.trim(),
      spec,
      ref: at >= 0 ? spec.slice(at + 1) : '',
      comment,
    });
  });
  return out;
}

/**
 * The judge. Pure: references -> problems.
 */
export function evaluate(refs) {
  const problems = [];
  let examined = 0;

  for (const r of refs) {
    // Local composite actions and docker refs are not pinnable this way.
    if (r.spec.startsWith('./') || r.spec.startsWith('docker://')) continue;
    examined += 1;

    if (!r.ref) {
      problems.push(`${r.file}:${r.line} has no @ref at all: ${r.raw}`);
      continue;
    }
    if (!SHA40.test(r.ref)) {
      problems.push(
        `${r.file}:${r.line} is NOT pinned to a commit SHA (found "${r.ref}"): ${r.raw}`,
      );
      continue;
    }
    // A pin with no version comment is correct but unreadable; a reviewer
    // cannot tell what they are approving. Warn-level, reported as a problem
    // so it cannot rot silently the way the v4/v7.0.1 comment did.
    if (!r.comment) {
      problems.push(
        `${r.file}:${r.line} is SHA-pinned but carries no version comment, so no ` +
        `reviewer can tell which release it is: ${r.raw}`,
      );
    }
  }

  return { problems, examined };
}

export function collect(dir) {
  const refs = [];
  for (const name of readdirSync(dir)) {
    if (!/\.ya?ml$/.test(name)) continue;
    refs.push(...parseUses(`${dir}/${name}`, readFileSync(join(dir, name), 'utf8')));
  }
  return refs;
}

function main(argv) {
  const dir = argv[0] || '.github/workflows';
  let refs;
  try {
    refs = collect(dir);
  } catch (err) {
    console.error(`::error::cannot read ${dir}: ${err.message}`);
    return 1;
  }

  const { problems, examined } = evaluate(refs);

  console.log(`Action pin check: examined ${examined} third-party reference(s) in ${dir}`);
  for (const r of refs) {
    if (r.spec.startsWith('./') || r.spec.startsWith('docker://')) continue;
    const ok = SHA40.test(r.ref) && r.comment;
    console.log(`  ${ok ? ' ' : '!'} ${r.file}:${r.line} ${r.spec}${r.comment ? `  # ${r.comment}` : ''}`);
  }

  // A run that examined nothing is a broken instrument, not a pass. This is
  // the check that distinguishes "scanned and found nothing wrong" from
  // "scanned nothing" - the distinction STP-700 exists to enforce.
  if (examined === 0) {
    console.error('');
    console.error(`::error::examined ZERO action references in ${dir}. A check that measured nothing is not a pass - the path or the parser is wrong.`);
    return 1;
  }

  if (problems.length > 0) {
    console.error('');
    console.error(`::error::${problems.length} action reference problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('');
    console.error('Pin third-party actions to a 40-character commit SHA with a "# vX.Y.Z" comment.');
    return 1;
  }

  console.log('');
  console.log(`PASS: all ${examined} third-party action reference(s) are SHA-pinned and commented.`);
  return 0;
}

if (process.argv[1] &&
    resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
