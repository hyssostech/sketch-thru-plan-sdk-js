// STP-754. Every third-party script or stylesheet loaded from a CDN must be
// pinned to an exact version and carry Subresource Integrity.
//
// WHY THIS IS A CHECK AND NOT A REVIEW HABIT. Twelve sample pages loaded the
// Microsoft speech SDK from `@latest` with no integrity attribute - so whatever
// the CDN served on the day was executed, unverified, in a page a user was
// invited to run. And the failure mode when someone gets it wrong is quiet:
// sdk-js PR #62 shipped a WRONG hash, which does not error the build, it just
// makes the browser refuse the script and the sample stop working.
//
// DELIBERATELY OFFLINE. It would be easy to fetch each URL and recompute the
// digest, and that is exactly what was done once, by hand, when the hashes were
// authored - 21 attributes verified against live bytes. But a gate that reaches
// the network goes red when a CDN hiccups, and a gate that cries wolf gets
// switched off. This asserts the STRUCTURE, which is what actually regresses:
// someone adds a script tag and forgets to pin or hash it.
//
// Usage: node .github/scripts/assert-cdn-pinned-and-sri.mjs [root]

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? '.';

// Directories that are build output or vendored code: not ours to police, and
// including them would make the check fail on things no human edits.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'docs-site']);

// Hosts that serve versioned, immutable assets - the ones SRI is designed for.
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'code.jquery.com',
];

// Loaders that bootstrap further scripts at runtime. SRI on these is not
// meaningful: the hash covers the loader, not what it goes on to fetch, and
// the ArcGIS loader is versioned in its own path. Pinning is still required.
const LOADER_EXEMPT = [/^https:\/\/js\.arcgis\.com\/\d+\.\d+\//];

// This repository's OWN published bundle. STP-754 ruling (option 2): pin the
// third-party dependency, and leave ours floating for now.
//
// Not an oversight and not a double standard - a cost. Pinning our own bundle
// in the samples couples every SDK release to a sample bump, the release
// workflow does not do that today, and a sample demoing a version behind the
// one just published is its own kind of wrong. STP-754 names option 1 (pin
// both) as preferable IF that bump is automated.
//
// Reported on every run rather than silently exempted, so the gap stays visible
// and someone has to decide again rather than inherit a decision.
const OWN_PACKAGE = /^https:\/\/cdn\.jsdelivr\.net\/npm\/sketch-thru-plan-sdk@/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(p, out);
    } else if (entry.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

const TAG = /<(script|link)\b[^>]*>/gi;

// Blank out the CONTENTS of HTML comments while preserving offsets and line
// structure, so a tag inside <!-- --> is not mistaken for one the browser will
// fetch. Measured before adding this: all 11 own-bundle references this script
// reported were commented-out copy-paste templates, 0 live, while the 30
// third-party ones it gates are all live. Reporting the 11 as unpinned
// subresources overstated the exposure, and an overstating gate is one people
// learn to discount.
const maskComments = (html) =>
  html.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '));
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
};

const problems = [];
const own = [];
let checked = 0;
let commentedTemplates = 0;

for (const file of walk(root)) {
  const html = readFileSync(file, 'utf8');
  const live = maskComments(html);

  // Commented-out CDN tags are documentation, not traffic. Counted so the
  // report can say so, rather than staying silent about them entirely.
  for (const [tag] of html.matchAll(TAG)) {
    const url = attr(tag, 'src') ?? attr(tag, 'href');
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (!CDN_HOSTS.includes(new URL(url).host)) continue;
    if (!live.includes(tag)) commentedTemplates++;
  }

  // Iterate the MASKED text: commented-out tags collapse to whitespace and
  // simply do not match, so they are neither gated nor counted.
  for (const [tag] of live.matchAll(TAG)) {
    const url = attr(tag, 'src') ?? attr(tag, 'href');
    if (!url || !/^https?:\/\//i.test(url)) continue;

    const host = new URL(url).host;
    if (!CDN_HOSTS.includes(host)) continue;

    // A stylesheet link is in scope; a preconnect/icon is not.
    if (/^<link/i.test(tag)) {
      const rel = (attr(tag, 'rel') ?? '').toLowerCase();
      if (rel !== 'stylesheet') continue;
    }

    checked++;
    const where = `${relative(root, file).split(sep).join('/')}`;
    const exempt = LOADER_EXEMPT.some((re) => re.test(url));

    if (OWN_PACKAGE.test(url)) {
      own.push(`${where} -> ${url}`);
      continue;
    }

    if (/@latest\b/.test(url) || /@\^|@~/.test(url)) {
      problems.push(`${where}: not pinned to an exact version -> ${url}`);
      continue; // an unpinned URL cannot meaningfully carry a hash
    }

    if (exempt) continue;

    if (!attr(tag, 'integrity')) {
      problems.push(`${where}: pinned but no integrity attribute -> ${url}`);
    } else if (!/^sha(256|384|512)-/.test(attr(tag, 'integrity'))) {
      problems.push(`${where}: integrity is not a sha256/384/512 digest -> ${url}`);
    } else if (attr(tag, 'crossorigin') === null) {
      // Without CORS the browser cannot check the hash and blocks the request.
      problems.push(`${where}: has integrity but no crossorigin -> ${url}`);
    }
  }
}

console.log(`Checked ${checked} CDN subresource(s) across ${walk(root).length} HTML file(s).`);

if (problems.length) {
  console.error('');
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  console.error(`FAIL: ${problems.length} CDN subresource(s) are unpinned or unverified.`);
  console.error('Pin to an exact version first - SRI is a hash of specific bytes, and');
  console.error('"@latest" has none - then add integrity + crossorigin="anonymous".');
  process.exit(1);
}

if (checked === 0) {
  console.error('FAIL: examined ZERO CDN subresources. This check measured nothing.');
  process.exit(1);
}

if (own.length) {
  console.log('');
  console.log(`NOTE: ${own.length} LIVE reference(s) to this repository's own bundle are`);
  console.log('unpinned. That is the STP-754 option-2 ruling, not an accident: pinning them');
  console.log('couples every release to a sample bump, which the release workflow does not');
  console.log('automate yet. Listed so the decision stays visible:');
  for (const o of own) console.log(`  ${o}`);
}

if (commentedTemplates) {
  console.log('');
  console.log(`(${commentedTemplates} CDN reference(s) sit inside HTML comments - copy-paste`);
  console.log(' templates showing how to load the published package. They are not fetched,');
  console.log(' so they are not gated. Mentioned only so their absence from the counts above');
  console.log(' is deliberate rather than a blind spot.)');
}

console.log('');
console.log('PASS: every third-party CDN subresource is pinned and carries SRI.');
