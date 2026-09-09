/**
 * Verify the bundled Vosk browser speech model has not drifted.
 *
 * The model is NOT authored here. It is built in the STP engine repo from
 *   Clients/MultiSpeech/Models/vosk-model-la-domain/
 * and deployed into this repo by
 *   Clients/MultiSpeech/vosk-model-builder/build/model_artifacts.py --deploy
 *      --js-sdk-root <this repo>
 * which writes both zips and the model-artifacts.sha256 stamp beside them.
 * Neither copy may be edited by hand.
 *
 * Why this exists (Jira STP-683): the same model used to sit in three
 * places under three different hashes. The two copies here were built
 * from the 2026-05-14 model and had missed two engine rebuilds, and they
 * were not even identical to each other - same 16 files, same content, 32
 * bytes of embedded zip timestamps apart, because each target used to be
 * zipped in its own run. Nothing in either repo compared them.
 *
 * Git LFS makes this check free. A pointer file records
 * `oid sha256:<hash>`, and that hash IS the sha256 of the file's content,
 * so a CI checkout without `lfs: true` can still verify both copies
 * without downloading 30 MB twice. When the content is present the bytes
 * are hashed directly instead.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const STAMP = 'plugins/speech/voskspeech-plugin/model/model-artifacts.sha256';
const COPIES = [
  'plugins/speech/voskspeech-plugin/model/vosk-model-la-domain.zip',
  'samples/basic/vosk-model-la-domain.zip',
];

const problems = [];

/**
 * sha256 of a file's content, whether the working tree holds the content
 * or an LFS pointer standing in for it.
 */
function contentDigest(relPath) {
  const buf = readFileSync(join(repoRoot, relPath));
  // A pointer is a short ASCII stub; a model zip starts with "PK".
  if (buf.length < 1024 && buf.subarray(0, 9).toString('ascii') === 'version h') {
    const match = /^oid sha256:([0-9a-f]{64})$/m.exec(buf.toString('utf8'));
    if (!match) {
      problems.push(`${relPath}: looks like an LFS pointer but has no sha256 oid`);
      return null;
    }
    return { digest: match[1], via: 'lfs pointer' };
  }
  return { digest: createHash('sha256').update(buf).digest('hex'), via: 'content' };
}

function readStamp() {
  const text = readFileSync(join(repoRoot, STAMP), 'utf8');
  const values = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const space = trimmed.indexOf(' ');
    if (space > 0) values[trimmed.slice(0, space)] = trimmed.slice(space + 1).trim();
  }
  return values;
}

let stamp;
try {
  stamp = readStamp();
} catch (err) {
  console.error(`Cannot read ${STAMP}: ${err.message}`);
  console.error(
    'It is written by the engine deploy and must travel with the zips.'
  );
  process.exit(1);
}

if (!stamp.zip) {
  problems.push(`${STAMP}: no "zip" digest recorded`);
}

const seen = new Map();
for (const rel of COPIES) {
  let result;
  try {
    result = contentDigest(rel);
  } catch (err) {
    problems.push(`${rel}: ${err.message}`);
    continue;
  }
  if (!result) continue;
  seen.set(rel, result.digest);
  const ok = stamp.zip && result.digest === stamp.zip;
  console.log(
    `  ${ok ? 'ok      ' : 'DRIFTED '} ${rel}  ${result.digest.slice(0, 12)} (${result.via})`
  );
  if (stamp.zip && !ok) {
    problems.push(
      `${rel}: ${result.digest} does not match the stamped ${stamp.zip}`
    );
  }
}

// Both copies are produced by copying one zip, so they must be identical.
// Content equality alone is not enough: two independent zip runs of the
// same model differ in their embedded timestamps, and that is exactly how
// these two copies diverged.
if (new Set(seen.values()).size > 1) {
  problems.push(
    'the two copies are not byte-identical: ' +
      [...seen].map(([k, v]) => `${k}=${v.slice(0, 12)}`).join(', ')
  );
}

if (problems.length > 0) {
  console.error('\nBundled speech model has DRIFTED:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    '\nDo not fix this by editing a zip. Re-run the engine deploy:\n' +
      '  cd <STP>/Clients/MultiSpeech/vosk-model-builder\n' +
      '  python -m build.model_artifacts --deploy --js-sdk-root <this repo>\n' +
      'then commit the regenerated zips and stamp together.'
  );
  process.exit(1);
}

console.log('Bundled speech model matches the stamped engine build.');
