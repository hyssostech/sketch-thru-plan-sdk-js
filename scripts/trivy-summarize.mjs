#!/usr/bin/env node
/*
 * STP-708 - count what Trivy actually found, and gate on it.
 *
 * Every vulnerability number that reaches ci-summary.md comes from this script.
 * Nothing downstream is allowed to write a literal count, because a literal is
 * how the STP engine's v5.10.8.0-rc5 release came to attest "0 CVEs in
 * application dependencies" while shipping a High.
 *
 * Two failure modes are guarded here, and they are not the same thing:
 *
 *   1. FINDINGS. Vulnerabilities at a fail-on severity cause a non-zero exit.
 *      The scan that feeds this script must NOT pass --ignore-unfixed on
 *      application dependencies. That filter answers "is a fix available",
 *      not "are we exposed"; in the engine it dropped a High whose advisory
 *      had first_patched_version = null, and the release said zero.
 *
 *   2. A VACUOUS OR PARTIAL CLEAN. "Zero findings" and "nothing was examined"
 *      are indistinguishable in an exit code, so this script proves COVERAGE:
 *      every component declared in the SBOM must appear in the set of packages
 *      Trivy reports having examined, and any that do not are named.
 *
 *      This replaces an earlier count-based check that was both off by one and
 *      the wrong shape. Measured 2026-09-09 with the pinned Trivy 0.70.0:
 *        - the intact 2-component SBOM -> 3 packages examined
 *          (@types/geojson, lodash, sketch-thru-plan-sdk) because Trivy also
 *          counts the metadata ROOT component;
 *        - the same SBOM with lodash's purl removed -> 2 packages examined
 *          (@types/geojson, sketch-thru-plan-sdk).
 *      A floor of "at least 2" therefore passed a scan in which lodash - the
 *      only runtime dependency carrying executable code - was never examined,
 *      and the release proceeded attesting HIGH: 0. Counting cannot say WHICH
 *      package went missing; coverage can, so coverage is the gate. The floor
 *      survives only as a cheap backstop.
 *
 *      Coverage requires the scan to run with list-all-pkgs enabled -
 *      otherwise Packages is not populated and there is nothing to compare.
 *
 * A missing or unparseable report is a failure, never a zero. Measured
 * 2026-09-09: Trivy 0.70.0 handed a CycloneDX 1.7 document aborts with
 * "SBOM decode error" and writes NO output file whatsoever.
 *
 * Usage:
 *   node scripts/trivy-summarize.mjs --report <trivy.json> --sbom <sbom.json>
 *                                    --fail-on CRITICAL,HIGH
 */

import { readFileSync, appendFileSync, existsSync } from 'node:fs';

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
for (const required of ['report', 'sbom']) {
  if (!args[required]) {
    console.error(`usage error: --${required} is required`);
    process.exit(2);
  }
}

const failOn = (args['fail-on'] || 'CRITICAL,HIGH')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

// A package URL identifies a package unambiguously, but the same package can
// be written more than one way - "@types/geojson" appears percent-escaped as
// %40types - and qualifiers or a subpath may be appended. Normalise to a
// single comparable form, and keep name@version as a second key so a component
// that carries no purl at all can still be matched if Trivy did examine it.
function purlKey(purl) {
  if (!purl) return null;
  const base = String(purl).split(/[?#]/)[0];
  let decoded = base;
  try {
    decoded = decodeURIComponent(base);
  } catch {
    /* a malformed escape is not a reason to drop the key */
  }
  return decoded.toLowerCase();
}

function nameKey(name, version) {
  if (!name) return null;
  return `${String(name).toLowerCase()}@${String(version ?? '')}`;
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

function emitOutputs(pairs) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `${Object.entries(pairs)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')}\n`,
  );
}

/* A missing report is not a clean report. */
if (!existsSync(args.report)) {
  console.error(`SCAN FAIL: no Trivy report at ${args.report}.`);
  console.error('Trivy writes no output file when it cannot decode the SBOM. This is');
  console.error('an unscanned release, not a clean one - refusing to report a count.');
  emitOutputs({ scan_measured: 'false' });
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(args.report, 'utf8'));
} catch (err) {
  console.error(`SCAN FAIL: Trivy report at ${args.report} is not parseable JSON: ${err.message}`);
  emitOutputs({ scan_measured: 'false' });
  process.exit(1);
}

/* The SBOM is the statement of what SHOULD have been scanned. Without it there
   is no way to tell a clean scan from a partial one. */
let sbom;
try {
  sbom = JSON.parse(readFileSync(args.sbom, 'utf8'));
} catch (err) {
  console.error(`SCAN FAIL: SBOM at ${args.sbom} is not readable or parseable: ${err.message}`);
  emitOutputs({ scan_measured: 'false' });
  process.exit(1);
}

const results = Array.isArray(report.Results) ? report.Results : [];
if (results.length === 0) {
  console.error('SCAN FAIL: Trivy report contains no Results. Nothing was examined.');
  emitOutputs({ scan_measured: 'false' });
  process.exit(1);
}

let packagesScanned = 0;
const scannedKeys = new Set();
const scannedNames = [];
const vulns = [];
for (const r of results) {
  for (const p of Array.isArray(r.Packages) ? r.Packages : []) {
    packagesScanned += 1;
    scannedNames.push(p.Name);
    const pk = purlKey(p.Identifier && p.Identifier.PURL);
    if (pk) scannedKeys.add(pk);
    const nk = nameKey(p.Name, p.Version);
    if (nk) scannedKeys.add(nk);
  }
  for (const v of Array.isArray(r.Vulnerabilities) ? r.Vulnerabilities : []) {
    vulns.push(v);
  }
}

/* Every component the SBOM declares must turn up in the scanned set. */
const declared = Array.isArray(sbom.components) ? sbom.components : [];
const uncovered = [];
for (const c of declared) {
  const coord = (c.group ? `${c.group}/${c.name}` : c.name) || '(unnamed)';
  const keys = [purlKey(c.purl), nameKey(coord, c.version), nameKey(c.name, c.version)].filter(Boolean);
  if (!keys.some((k) => scannedKeys.has(k))) {
    uncovered.push(`${coord}@${c.version ?? '(no version)'}`);
  }
}

const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
for (const v of vulns) {
  const sev = String(v.Severity || 'UNKNOWN').toUpperCase();
  if (counts[sev] === undefined) counts.UNKNOWN += 1;
  else counts[sev] += 1;
}

const trivyVersion = (report.Trivy && report.Trivy.Version) || 'unknown';

console.log(`Trivy report:      ${args.report}`);
console.log(`Trivy version:     ${trivyVersion}`);
console.log(`Artifact:          ${report.ArtifactName} (${report.ArtifactType})`);
console.log(`SBOM:              ${args.sbom}`);
console.log(`Components declared: ${declared.length}`);
console.log(`Packages examined: ${packagesScanned} [${scannedNames.join(', ')}]`);
console.log(`Declared components not examined: ${uncovered.length}`);
console.log('Vulnerabilities by severity:');
for (const s of SEVERITIES) {
  console.log(`  ${s.padEnd(9)} ${counts[s]}`);
}
console.log(`  ${'TOTAL'.padEnd(9)} ${vulns.length}`);

if (vulns.length > 0) {
  console.log('');
  console.log('Findings:');
  for (const v of vulns) {
    console.log(`  [${v.Severity}] ${v.VulnerabilityID} ${v.PkgName}@${v.InstalledVersion} -> fixed in ${v.FixedVersion || '(no fix published)'}`);
  }
}

emitOutputs({
  scan_measured: 'true',
  trivy_version: trivyVersion,
  packages_scanned: String(packagesScanned),
  components_declared: String(declared.length),
  components_uncovered: String(uncovered.length),
  vuln_critical: String(counts.CRITICAL),
  vuln_high: String(counts.HIGH),
  vuln_medium: String(counts.MEDIUM),
  vuln_low: String(counts.LOW),
  vuln_unknown: String(counts.UNKNOWN),
  vuln_total: String(vulns.length),
});

let failed = false;

/* THE COVERAGE GATE. A count cannot tell you which package went missing; this
   names them. Measured: dropping one component's purl removes it from Trivy's
   package list entirely while the scan still exits 0 reporting zero findings. */
if (uncovered.length > 0) {
  console.error('');
  console.error(`SCAN FAIL: ${uncovered.length} component(s) declared in the SBOM were never`);
  console.error('examined by Trivy:');
  for (const u of uncovered) {
    console.error(`  - ${u}`);
  }
  console.error('');
  console.error('These packages have no scan result, so no statement about their');
  console.error('vulnerabilities is supported. A partial scan is not a clean scan.');
  failed = true;
}

/* Cheap backstop. Coverage above is the real gate; this catches a report that
   is structurally intact but empty of packages, without asserting anything
   about how Trivy counts the metadata root component. */
if (declared.length > 0 && packagesScanned === 0) {
  console.error('');
  console.error('SCAN FAIL: Trivy examined 0 packages while the SBOM declared');
  console.error(`${declared.length}. Nothing was read - a clean result here is vacuous.`);
  failed = true;
}

const gated = failOn.reduce((n, s) => n + (counts[s] || 0), 0);
if (gated > 0) {
  console.error('');
  console.error(`SCAN FAIL: ${gated} vulnerability/vulnerabilities at severity ${failOn.join(' or ')}.`);
  console.error('Note: this gate deliberately does not pass --ignore-unfixed. A finding');
  console.error('with no upstream fix is still an exposure.');
  failed = true;
}

process.exit(failed ? 1 : 0);
