#!/usr/bin/env node
/*
 * Unit tests for assert-action-pins.mjs (STP-728).
 *
 * The ticket's acceptance criterion is explicit: a PR introducing
 * `uses: someone/action@v1` must FAIL, "demonstrated on a real PR or a control
 * file, not asserted". These are the control files, in memory.
 *
 * Run: node .github/scripts/tests/test-assert-action-pins.mjs
 */

import { parseUses, evaluate } from '../assert-action-pins.mjs';

let failures = 0;

function check(label, yaml, expectPass, mustMention = []) {
  const refs = parseUses('control.yml', yaml);
  const { problems, examined } = evaluate(refs);
  const passed = problems.length === 0 && examined > 0;
  const ok = passed === expectPass;
  const missing = mustMention.filter(
    (m) => !problems.some((p) => p.toLowerCase().includes(m.toLowerCase())),
  );

  if (!ok || missing.length > 0) {
    failures += 1;
    console.log(`  WRONG  ${label}`);
    console.log(`         expected ${expectPass ? 'PASS' : 'FAIL'}, got ${passed ? 'PASS' : 'FAIL'} (examined ${examined})`);
    for (const m of missing) console.log(`         expected a problem mentioning: ${m}`);
    for (const p of problems) console.log(`         problem: ${p.slice(0, 110)}`);
  } else {
    console.log(`  OK     ${label}  (examined ${examined}${problems.length ? `, ${problems.length} problem(s)` : ''})`);
  }
}

const SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';

console.log("=== the ticket's acceptance criterion ===");
check(
  'uses: someone/action@v1 must FAIL',
  `jobs:\n  a:\n    steps:\n      - uses: someone/action@v1\n`,
  false,
  ['NOT pinned'],
);

check(
  'a properly pinned and commented ref passes',
  `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA} # v7.0.1\n`,
  true,
);

console.log('');
console.log('=== the floating forms that must all be caught ===');
for (const [ref, why] of [
  ['v4', 'major tag'],
  ['v7.0.1', 'exact tag'],
  ['main', 'branch'],
  ['3d3c42e', 'short sha'],
  ['3D3C42E5AAC5BA805825DA76410C181273BA90B1', 'uppercase sha is not the pinned form'],
]) {
  check(
    `@${ref} (${why})`,
    `steps:\n      - uses: actions/checkout@${ref} # x\n`,
    false,
    ['NOT pinned'],
  );
}

console.log('');
console.log('=== the readable half - the v4/v7.0.1 drift this ticket was raised for ===');
check(
  'SHA-pinned but with NO version comment',
  `steps:\n      - uses: actions/checkout@${SHA}\n`,
  false,
  ['no version comment'],
);

console.log('');
console.log('=== the instrument check: scanning nothing must not read as a pass ===');
check(
  'a workflow with no uses: at all fails as a broken instrument',
  `name: CI\non:\n  push:\njobs:\n  a:\n    steps:\n      - run: echo hi\n`,
  false,
);

console.log('');
console.log('=== controls: these must PASS, or the check is over-eager ===');
check(
  'local composite action is exempt',
  `steps:\n      - uses: ./.github/actions/thing\n      - uses: actions/checkout@${SHA} # v7.0.1\n`,
  true,
);
check(
  'docker ref is exempt',
  `steps:\n      - uses: docker://alpine:3.20\n      - uses: actions/checkout@${SHA} # v7.0.1\n`,
  true,
);
check(
  'a subpath action pins the same way',
  `steps:\n      - uses: github/codeql-action/init@${SHA} # v4.38.0\n`,
  true,
);
check(
  'several good refs together',
  `steps:\n      - uses: actions/checkout@${SHA} # v7.0.1\n      - uses: actions/setup-node@${SHA} # v7.0.0\n`,
  true,
);

console.log('');
console.log('=== parser shape: the form must not matter ===');
{
  const variants = [
    `      - uses: actions/checkout@${SHA} # v7.0.1`,
    `        uses: actions/checkout@${SHA} # v7.0.1`,
    `      - uses: actions/checkout@${SHA}   #   v7.0.1`,
  ];
  for (const v of variants) {
    const refs = parseUses('c.yml', v);
    const got = refs.length === 1 && refs[0].ref === SHA && refs[0].comment === 'v7.0.1';
    if (!got) {
      failures += 1;
      console.log(`  WRONG  parse ${JSON.stringify(v.trim().slice(0, 50))} -> ${JSON.stringify(refs)}`);
    } else {
      console.log(`  OK     parsed ${JSON.stringify(v.trim().slice(0, 46))}...`);
    }
  }
}

console.log('');
if (failures > 0) {
  console.error(`FAILED: ${failures} case(s) did not behave as specified.`);
  process.exit(1);
}
console.log('All cases behaved as specified.');
