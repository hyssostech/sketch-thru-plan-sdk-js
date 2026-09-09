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
 *   2. A VACUOUS CLEAN. Measured 2026-09-09 with Trivy 0.70.0: a CycloneDX
 *      document containing zero components scans successfully, exits 0, and
 *      reports zero vulnerabilities over a single package - the metadata root
 *      component, which is always there. "Zero findings" and "nothing was
 *      examined" are indistinguishable in the exit code. So --min-packages
 *      asserts that Trivy actually decoded and examined at least as many
 *      packages as the SBOM declared components. This requires the scan to
 *      run with list-all-pkgs enabled, otherwise Packages is not populated.
 *
 * A missing or unparseable report is a failure, never a zero. Measured
 * 2026-09-09: Trivy 0.70.0 handed a CycloneDX 1.7 document aborts with
 * "SBOM decode error" and writes NO output file whatsoever.
 *
 * Usage:
 *   node scripts/trivy-summarize.mjs --report <trivy.json>
 *                                    --fail-on CRITICAL,HIGH
 *                                    --min-packages <n>
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
if (!args.report) {
  console.error('usage error: --report is required');
  process.exit(2);
}

const failOn = (args['fail-on'] || 'CRITICAL,HIGH')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const minPackages = Number.parseInt(args['min-packages'] ?? '1', 10);
if (!Number.isFinite(minPackages) || minPackages < 0) {
  console.error(`usage error: --min-packages must be a non-negative integer, got ${args['min-packages']}`);
  process.exit(2);
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

const results = Array.isArray(report.Results) ? report.Results : [];
if (results.length === 0) {
  console.error('SCAN FAIL: Trivy report contains no Results. Nothing was examined.');
  emitOutputs({ scan_measured: 'false' });
  process.exit(1);
}

let packagesScanned = 0;
const vulns = [];
for (const r of results) {
  packagesScanned += Array.isArray(r.Packages) ? r.Packages.length : 0;
  for (const v of Array.isArray(r.Vulnerabilities) ? r.Vulnerabilities : []) {
    vulns.push(v);
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
console.log(`Packages examined: ${packagesScanned}`);
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
  vuln_critical: String(counts.CRITICAL),
  vuln_high: String(counts.HIGH),
  vuln_medium: String(counts.MEDIUM),
  vuln_low: String(counts.LOW),
  vuln_unknown: String(counts.UNKNOWN),
  vuln_total: String(vulns.length),
});

let failed = false;

if (packagesScanned < minPackages) {
  console.error('');
  console.error(`SCAN FAIL: Trivy examined ${packagesScanned} package(s) but the SBOM declared`);
  console.error(`at least ${minPackages}. A clean result over an unread SBOM is not a clean result.`);
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
