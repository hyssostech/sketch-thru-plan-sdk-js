#!/usr/bin/env node
/*
 * STP-698 Phase 5. Verify the claim the publish workflow already prints.
 *
 * publish.yml skips a package whose version is already on the registry, and
 * says:
 *
 *     SKIPPED: <name>@<version> is already on the registry -
 *              this package did not change in this release.
 *
 * The skip is right. A `plugins-v*` tag publishes a SET of six packages that
 * version independently, so most of them are unchanged in any given release and
 * failing on each would produce a red nobody can act on.
 *
 * The SENTENCE is the problem: "this package did not change" is an assertion
 * the workflow never checked. When it is false, the skip is exactly how a real
 * change fails to ship - green run, nothing published, no signal.
 *
 * It was false. Measured against the tarballs npm was serving:
 *
 *   @hyssostech/awsspeech-plugin 0.1.1
 *       npm  : @aws-sdk/client-transcribe-streaming ^3.998.0
 *       repo : @aws-sdk/client-transcribe-streaming ^3.1130.0
 *
 *   @hyssostech/azurespeech-plugin 0.3.4
 *       npm  : agent-base ^7.1.4  https-proxy-agent ^7.0.6  uuid ^13.0.0
 *       repo : agent-base ^9.0.0  https-proxy-agent ^9.1.0  uuid ^14.0.2
 *
 * Three major RUNTIME bumps under an unchanged version number, arriving one
 * Dependabot PR at a time, each individually reasonable.
 *
 * WHAT IS COMPARED, and against what
 *
 * The PUBLISHED TARBALL's own package.json - not the registry metadata
 * document. The registry metadata omits `files` entirely: sketch-thru-plan-sdk
 * declares `files: ["dist", "!dist/**\/*.js.map"]`, and the metadata reports it
 * absent while the tarball reports it correctly. Comparing against the metadata
 * produced a false positive on every package in the repository.
 *
 * Only fields that describe what a CONSUMER receives. `devDependencies` are
 * excluded deliberately - they change nothing about the installed package, and
 * including them would make every dev-tooling bump a release blocker.
 *
 * FAILS CLOSED. An unreachable registry or an unreadable tarball is non-zero:
 * this runs on the publish path, where "could not check" must not read as
 * "nothing changed".
 *
 * Usage:
 *   node assert-published-content-matches.mjs <name> <version> <localPackageJson|.tgz>
 *        [--published-manifest <path>]   # offline, for the controls
 */
import { readFileSync } from 'node:fs';

import { readFromTgz } from './lib/read-tgz.mjs';

const [, , name, version, localManifestPath, ...rest] = process.argv;

if (!name || !version || !localManifestPath) {
  console.error(
    'usage: assert-published-content-matches.mjs <name> <version> <localPackageJson|.tgz> ' +
      '[--published-manifest <path>]'
  );
  process.exit(2);
}

let publishedOverride = null;
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i] === '--published-manifest') publishedOverride = rest[i + 1];
}

const die = (msg) => {
  console.error(`::error::${msg}`);
  process.exit(1);
};

/* ------------------------------------------------------------------ transport */

// node:https rather than the global fetch: undici holds a keep-alive socket and
// process.exit() while it is open aborts the process on Windows, turning a
// PASSING check into exit 127. Measured on the .NET sibling's equivalent script.
function get(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    import('node:https').then(({ get: httpsGet }) => {
      const req = httpsGet(url, { headers: { accept: '*/*' } }, (res) => {
        const { statusCode, headers } = res;
        if ([301, 302, 307, 308].includes(statusCode) && headers.location) {
          res.resume();
          if (redirectsLeft === 0) return reject(new Error(`too many redirects from ${url}`));
          return resolve(get(new URL(headers.location, url).toString(), redirectsLeft - 1));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ statusCode, body: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.setTimeout(60000, () => req.destroy(new Error('timed out after 60s')));
    }, reject);
  });
}

/* ------------------------------------------------------------------ the check */

// What a consumer actually receives. devDependencies and scripts are out: the
// first changes nothing installed, and npm rewrites parts of the second.
const COMPARED = [
  'dependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'optionalDependencies',
  'bundledDependencies',
  'files',
  'main',
  'module',
  'types',
  'typings',
  'exports',
  'bin',
  'engines',
  'sideEffects',
];

async function publishedManifest() {
  if (publishedOverride) {
    const raw = readFileSync(publishedOverride);
    if (publishedOverride.endsWith('.tgz')) {
      const found = readFromTgz(raw, 'package/package.json');
      if (found === null) die(`${publishedOverride} contains no package/package.json`);
      return JSON.parse(found);
    }
    return JSON.parse(raw.toString('utf8'));
  }

  // encodeURIComponent, not `.replace('/', '%2f')`. CodeQL flagged the latter as
  // js/incomplete-sanitization and it is right: String.replace with a string
  // pattern rewrites only the FIRST occurrence, so a name with more than one
  // slash would build a URL with a real path separator still in it. A scoped
  // package has exactly one today, which is precisely the kind of "works now"
  // that stops working silently. Verified against the live registry: all of
  // @scope%2fname, @scope%2Fname and %40scope%2Fname return the correct package.
  const doc = await get(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (doc.statusCode === 404) return null; // never published at all
  if (doc.statusCode !== 200) {
    die(`registry answered HTTP ${doc.statusCode} for ${name}. Cannot verify, so not skipping.`);
  }

  let meta;
  try {
    meta = JSON.parse(doc.body.toString('utf8'));
  } catch (e) {
    die(`registry answer for ${name} was not JSON: ${e.message}. Cannot verify.`);
  }
  const entry = meta.versions?.[version];
  if (!entry) return null; // this version is not published

  const tarballUrl = entry.dist?.tarball;
  if (!tarballUrl) die(`${name}@${version} has no dist.tarball in the registry answer.`);

  const tgz = await get(tarballUrl);
  if (tgz.statusCode !== 200) {
    die(`${tarballUrl} answered HTTP ${tgz.statusCode}. Cannot verify, so not skipping.`);
  }

  // NOTE: the tarball's OWN package.json, not the registry metadata document.
  // The metadata omits `files`, which made a naive comparison report a
  // difference for every package in the repository.
  const found = readFromTgz(tgz.body, 'package/package.json');
  if (found === null) die(`${tarballUrl} contains no package/package.json.`);
  return JSON.parse(found);
}

// The local side accepts a .tgz as well as a package.json, and the .tgz is the
// better input: it is what WOULD be published, read the same way as what IS
// published, so the two sides of the comparison come from the same kind of
// artifact rather than one from a manifest and one from a tarball.
let local;
try {
  const raw = readFileSync(localManifestPath);
  if (localManifestPath.endsWith('.tgz')) {
    const found = readFromTgz(raw, 'package/package.json');
    if (found === null) die(`${localManifestPath} contains no package/package.json`);
    local = JSON.parse(found);
  } else {
    local = JSON.parse(raw.toString('utf8'));
  }
} catch (e) {
  die(`could not read ${localManifestPath}: ${e.message}`);
}

let published;
try {
  published = await publishedManifest();
} catch (e) {
  die(`could not read the published ${name}@${version}: ${e.message}. Cannot verify, so not skipping.`);
}

if (published === null) {
  console.log(`${name}@${version} is not on the registry - a new version, nothing to compare.`);
  process.exit(0);
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const diffs = COMPARED.filter((f) => !same(published[f], local[f]));

console.log(`Compared ${COMPARED.length} consumer-facing field(s) of ${name}@${version} against the published tarball.`);

if (diffs.length > 0) {
  console.error('');
  console.error(`${name}@${version} is already published, but this tree's content DIFFERS from it:`);
  for (const f of diffs) {
    console.error(`  - ${f}`);
    console.error(`      npm : ${JSON.stringify(published[f] ?? null)}`);
    console.error(`      repo: ${JSON.stringify(local[f] ?? null)}`);
  }
  console.error('');
  console.error('Skipping this package would be wrong: the workflow would print "this package');
  console.error('did not change in this release" and ship nothing, with a green run. Bump the');
  console.error(`version of ${name} so the change has a version number of its own.`);
  process.exit(1);
}

console.log(`${name}@${version} matches what npm serves - skipping it is correct.`);
