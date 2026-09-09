#!/usr/bin/env node
/*
 * STP-708 - assert that a generated CycloneDX SBOM is the thing we think it is.
 *
 * The generator's flags are not evidence. Three failures inherited from the STP
 * engine repo (see the v5.10.8.0-rc5 release-attestation review) are checked
 * here against the emitted document instead of trusted to the tool:
 *
 *   1. SPEC VERSION DRIFT. The engine shipped a CycloneDX 1.7 SBOM because the
 *      generator's default moved. Trivy 0.70 cannot decode 1.7 - it aborts with
 *      "CycloneDX decode error: invalid specification version" and writes no
 *      report at all - so the SBOM shipped and nothing could read it. We pass
 *      --spec-version explicitly AND assert the emitted specVersion here.
 *
 *   2. WRONG METADATA VERSION. The engine's Windows SBOM described itself as
 *      "STP 0.0.0". An SBOM that does not name the release it belongs to cannot
 *      be matched to an artifact after the fact.
 *
 *   3. SCOPE DRIFT. The engine's SBOM carried 20 test-only packages. Passing
 *      --omit dev is not proof that dev dependencies were omitted, so we check
 *      the component list against package.json directly.
 *
 * The dangerous direction of failure is a VACUOUS PASS: an SBOM with no
 * components satisfies "contains no devDependencies" perfectly, and a scanner
 * then reports zero vulnerabilities over zero packages. So every negative
 * assertion here is paired with a positive one - the declared runtime
 * dependencies must actually be present.
 *
 * Usage:
 *   node scripts/assert-sbom.mjs --sbom <file> --manifest <package.json>
 *                                --expect-spec 1.6 --expect-version <version>
 *
 * Exits 0 only if every assertion holds. Writes machine-readable values to
 * $GITHUB_OUTPUT when that variable is set.
 */

import { readFileSync, appendFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = 'true';
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const required = ['sbom', 'manifest', 'expect-spec', 'expect-version', 'expect-tool', 'expected'];
for (const r of required) {
  if (!args[r]) {
    console.error(`usage error: --${r} is required`);
    process.exit(2);
  }
}

const failures = [];
const notes = [];

function check(ok, description, detail) {
  if (ok) {
    console.log(`  PASS  ${description}`);
  } else {
    console.log(`  FAIL  ${description}${detail ? ` -- ${detail}` : ''}`);
    failures.push(`${description}${detail ? ` -- ${detail}` : ''}`);
  }
}

let sbom;
try {
  sbom = JSON.parse(readFileSync(args.sbom, 'utf8'));
} catch (err) {
  console.error(`ASSERT FAIL: cannot read or parse SBOM at ${args.sbom}: ${err.message}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(args.manifest, 'utf8'));
} catch (err) {
  console.error(`ASSERT FAIL: cannot read or parse manifest at ${args.manifest}: ${err.message}`);
  process.exit(1);
}

// The expected component set, tracked in the repository so that changing the
// published dependency surface is a reviewed act rather than a silent one.
let expected;
try {
  expected = JSON.parse(readFileSync(args.expected, 'utf8'));
} catch (err) {
  console.error(`ASSERT FAIL: cannot read or parse ${args.expected}: ${err.message}`);
  process.exit(1);
}

console.log(`SBOM assertions for ${args.sbom}`);

/* --- document identity ------------------------------------------------- */

check(sbom.bomFormat === 'CycloneDX', 'bomFormat is CycloneDX', `got ${JSON.stringify(sbom.bomFormat)}`);

check(
  sbom.specVersion === args['expect-spec'],
  `specVersion is pinned to ${args['expect-spec']}`,
  `got ${JSON.stringify(sbom.specVersion)} - a version Trivy cannot decode ships an unreadable SBOM`,
);

/* --- metadata component ------------------------------------------------ */

const mc = (sbom.metadata && sbom.metadata.component) || {};

check(
  mc.name === manifest.name,
  `metadata.component.name is ${manifest.name}`,
  `got ${JSON.stringify(mc.name)}`,
);

check(
  mc.version === args['expect-version'],
  `metadata.component.version is ${args['expect-version']}`,
  `got ${JSON.stringify(mc.version)}`,
);

check(
  mc.version !== '0.0.0',
  'metadata.component.version is not the placeholder 0.0.0',
  `got ${JSON.stringify(mc.version)}`,
);

/* --- the generator, read from the document rather than assumed ---------- */

// CycloneDX 1.5 and later record tools as {components:[], services:[]};
// 1.4 and earlier used a flat array of {vendor,name,version}. Accept both.
const toolsRaw = (sbom.metadata && sbom.metadata.tools) || {};
const toolComponents = Array.isArray(toolsRaw)
  ? toolsRaw
  : Array.isArray(toolsRaw.components)
    ? toolsRaw.components
    : [];
const toolIds = toolComponents.map((t) => {
  const name = t.group ? `${t.group}/${t.name}` : t.name;
  return `${name}@${t.version}`;
});

check(
  toolIds.length > 0,
  'the SBOM records which tool produced it',
  'metadata.tools is empty - the document cannot say where it came from',
);

// The workflow pins the generator; this closes the loop by asserting the
// document agrees. ci-summary.md then reports the generator READ FROM HERE,
// so the published summary never restates a workflow literal as if it were
// an observation.
const expectedTool = args['expect-tool'];
const generator = toolIds.find((id) => id === expectedTool);
check(
  Boolean(generator),
  `the SBOM says it was produced by ${expectedTool}`,
  `metadata.tools records: ${toolIds.join(', ') || '(none)'}`,
);

/* --- component set ----------------------------------------------------- */

const components = Array.isArray(sbom.components) ? sbom.components : [];

// Canonical npm coordinate: CycloneDX splits a scoped name into group + name,
// so "@types/geojson" arrives as group "@types", name "geojson".
const coord = (c) => (c.group ? `${c.group}/${c.name}` : c.name);
const present = new Set(components.map(coord));

const runtimeDeps = Object.keys(manifest.dependencies || {});
const devDeps = Object.keys(manifest.devDependencies || {});

// THE VACUOUS-PASS GUARD. Everything below this line is a negative assertion,
// and an empty component list satisfies every one of them.
check(
  components.length > 0,
  'SBOM has at least one component (an empty SBOM would pass every check below vacuously)',
  `got ${components.length}`,
);

check(
  components.length >= runtimeDeps.length,
  `component count (${components.length}) covers at least the ${runtimeDeps.length} declared runtime dependencies`,
  'fewer components than declared direct dependencies means the closure was truncated',
);

for (const dep of runtimeDeps) {
  check(present.has(dep), `runtime dependency ${dep} is present in the SBOM`);
}

// THE WHOLE-SET ASSERTION. Everything else in this section is a named
// blocklist, and a blocklist can only catch the categories it thought of - a
// component that is neither a devDependency nor a sibling plugin would pass
// every one of them. This compares the component set in BOTH directions and
// names the difference either way.
const expectedComponents = Array.isArray(expected.sbomComponents) ? expected.sbomComponents : null;
if (!expectedComponents || expectedComponents.length === 0) {
  check(false, `${args.expected} declares no sbomComponents to compare against`);
} else {
  const actualSet = [...present].sort();
  const wantSet = [...expectedComponents].sort();
  const missingComponents = wantSet.filter((c) => !actualSet.includes(c));
  const unexpectedComponents = actualSet.filter((c) => !wantSet.includes(c));
  check(
    missingComponents.length === 0,
    'no expected component is missing from the SBOM',
    `missing: ${missingComponents.join(', ')}`,
  );
  check(
    unexpectedComponents.length === 0,
    'no unexpected component appears in the SBOM',
    `unexpected: ${unexpectedComponents.join(', ')}`,
  );
  notes.push(`component set compared against ${args.expected}: ${wantSet.length} expected`);
}

const devLeaks = devDeps.filter((d) => present.has(d) && !runtimeDeps.includes(d));
check(
  devLeaks.length === 0,
  'no declared devDependency appears in the SBOM',
  `leaked: ${devLeaks.join(', ')}`,
);

// The seven sibling plugin packages version and publish independently
// (.github/workflows/publish.yml). None of them ships inside this package, so
// none of them belongs in this SBOM. They all live under one npm scope.
const siblingScope = '@hyssostech';
const siblingLeaks = components
  .filter((c) => c.group === siblingScope || coord(c).startsWith(`${siblingScope}/`))
  .map(coord);
check(
  siblingLeaks.length === 0,
  `no ${siblingScope} sibling package appears in the SBOM`,
  `leaked: ${siblingLeaks.join(', ')}`,
);

notes.push(`components: ${components.length}`);
notes.push(`runtime dependencies declared: ${runtimeDeps.length}`);
notes.push(`devDependencies declared: ${devDeps.length}`);

/* --- report ------------------------------------------------------------ */

console.log('');
for (const n of notes) {
  console.log(`  note: ${n}`);
}
console.log('');
console.log('  component list:');
for (const c of components) {
  console.log(`    - ${coord(c)}@${c.version}`);
}
console.log('');

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `sbom_components=${components.length}`,
      `sbom_spec=${sbom.specVersion}`,
      `sbom_tool=${generator || ''}`,
      `sbom_mc_name=${mc.name}`,
      `sbom_mc_version=${mc.version}`,
      '',
    ].join('\n'),
  );
}

if (failures.length > 0) {
  console.error(`SBOM ASSERTIONS FAILED (${failures.length}):`);
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}

console.log(`All SBOM assertions passed (${components.length} components, CycloneDX ${sbom.specVersion}).`);
