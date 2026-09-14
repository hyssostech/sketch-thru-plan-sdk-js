/**
 * No workflow job may both hold a privileged token AND run a dependency install.
 *
 * WHY
 *
 * `npm ci` and `npm install` execute preinstall/install/postinstall scripts
 * from every dependency in the tree - arbitrary third-party code, as the runner
 * user. A job granted `id-token: write` gets ACTIONS_ID_TOKEN_REQUEST_URL and
 * ACTIONS_ID_TOKEN_REQUEST_TOKEN as ordinary environment variables, readable by
 * every process in that job. Put those together and a lifecycle script in any
 * transitive dependency can mint an OIDC token and publish to npm under this
 * project's identity, without going anywhere near the publish step.
 *
 * Trusted Publishing removed the long-lived npm token, which was the right
 * move, but the OIDC capability is scoped to the JOB rather than to the publish
 * command. So the property worth enforcing is structural: build where there is
 * no token, publish where there is no third-party code.
 *
 * WHAT ACTUALLY GATES THE RISK, so this is not oversold: `npm ci` installs from
 * the lockfile with integrity hashes, so an attacker cannot alter an
 * already-pinned version. The realistic window is a dependency BUMP that pulls
 * in a version whose publisher was compromised - the shape of event-stream,
 * ua-parser-js and coa/rc, and this repository takes grouped Dependabot
 * updates. Not "exploitable today"; rather, the blast radius of one bad bump is
 * publish rights instead of a failed build.
 *
 * WHY A CHECKER AND NOT JUST THE FIX
 *
 * publish-sdk.yml and publish.yml were both split by hand. Nothing stops the
 * next person merging the two jobs back together for convenience, or adding an
 * `npm ci` to the publish job to get a tool onto the PATH. Both would be
 * entirely reasonable-looking changes that silently restore the problem. This
 * turns a pair of one-off fixes into a property the repository keeps.
 *
 * SCOPE: `contents: write`, `packages: write` and `id-token: write` all count as
 * privileged - each can push, publish, or mint a credential. `contents: read`
 * does not.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Permissions that let a job change or publish something outside itself.
const PRIVILEGED = ['id-token', 'contents', 'packages', 'attestations', 'deployments'];

// Installs that execute dependency lifecycle scripts. `npm ci --ignore-scripts`
// does NOT, and is deliberately allowed: it is the mitigation, not the hazard.
const INSTALL = /\b(?:npm\s+(?:ci|install|i)\b|yarn\s+(?:install)?\b|pnpm\s+(?:install|i)\b)/;
const IGNORES_SCRIPTS = /--ignore-scripts\b/;

const root = process.argv[2] ?? '.github/workflows';
const problems = [];
let jobsExamined = 0;

function isPrivileged(perms) {
  if (perms === 'write-all') return ['write-all'];
  if (!perms || typeof perms !== 'object') return [];
  return PRIVILEGED.filter((k) => perms[k] === 'write');
}

// Minimal YAML reach: we only need job names, their `permissions` block, and the
// `run:` text of their steps. A dependency-free line walk is enough for that and
// keeps this script runnable on a bare runner, which is where it has to work.
function parse(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const jobs = [];
  let inJobs = false;
  let cur = null;
  let wfPerms = null;
  let permCtx = null; // {target, indent}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const indent = line.length - line.trimStart().length;

    if (/^jobs:\s*$/.test(line)) { inJobs = true; permCtx = null; continue; }

    if (/^permissions:\s*$/.test(line) && !inJobs) {
      wfPerms = {};
      permCtx = { target: wfPerms, indent: 0 };
      continue;
    }
    if (/^permissions:\s*write-all\s*$/.test(line) && !inJobs) { wfPerms = 'write-all'; continue; }

    if (inJobs && /^  [A-Za-z0-9_-]+:\s*$/.test(line)) {
      cur = { name: line.trim().replace(/:$/, ''), perms: null, runs: [], line: i + 1 };
      jobs.push(cur);
      permCtx = null;
      continue;
    }

    if (cur && /^\s*permissions:\s*$/.test(line)) {
      cur.perms = {};
      permCtx = { target: cur.perms, indent };
      continue;
    }
    if (cur && /^\s*permissions:\s*write-all\s*$/.test(line)) { cur.perms = 'write-all'; continue; }

    if (permCtx) {
      const m = line.match(/^\s*([a-z-]+):\s*(read|write|none)\s*$/);
      if (m && indent > permCtx.indent) { permCtx.target[m[1]] = m[2]; continue; }
      if (indent <= permCtx.indent) permCtx = null;
    }

    if (cur) {
      const m = line.match(/^\s*(?:- name:.*)?\s*run:\s*(.*)$/);
      if (m) {
        if (m[1] && m[1] !== '|' && m[1] !== '>') {
          cur.runs.push(m[1]);
        } else {
          // block scalar: consume the more-indented lines
          for (let j = i + 1; j < lines.length; j++) {
            const l = lines[j];
            if (!l.trim()) continue;
            const ind = l.length - l.trimStart().length;
            if (ind <= indent) break;
            cur.runs.push(l);
          }
        }
      }
    }
  }
  return { wfPerms, jobs };
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.ya?ml$/.test(e)) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8');
  const { wfPerms, jobs } = parse(text);
  const where = relative(process.cwd(), file).split(sep).join('/');

  for (const job of jobs) {
    jobsExamined++;
    // A job with no permissions block inherits the workflow default.
    const effective = job.perms ?? wfPerms;
    const priv = isPrivileged(effective);
    const inherited = job.perms == null && priv.length > 0;

    const installs = job.runs.filter((r) => INSTALL.test(r) && !IGNORES_SCRIPTS.test(r));
    if (priv.length && installs.length) {
      problems.push(
        `${where}: job "${job.name}" holds ${priv.map((p) => `${p}: write`).join(', ')}` +
          `${inherited ? ' (INHERITED from the workflow default)' : ''} and runs an install that ` +
          `executes dependency scripts:\n        ${installs[0].trim().slice(0, 90)}\n` +
          '        Split the job, or pass --ignore-scripts. Third-party install code must not ' +
          'run while a credential is available.'
      );
    }
  }
}

console.log(`Examined ${jobsExamined} job(s) under ${root}`);

if (problems.length) {
  console.error('');
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  console.error(`FAIL: ${problems.length} job(s) run untrusted install code while privileged.`);
  process.exit(1);
}

console.log('PASS: no job both holds a privileged token and runs a script-executing install.');
