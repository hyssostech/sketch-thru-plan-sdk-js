/*
 * Pull one file out of a gzipped tar.
 *
 * Its own module rather than an export from the checker that uses it, because a
 * control that imports the checker executes the checker: the tar controls were
 * running the script's argument parsing and getting a usage error instead of a
 * function. A unit worth testing has to be importable without side effects.
 *
 * npm tarballs are plain ustar with every entry under `package/`, so this is not
 * a full tar implementation. The two things that DO bite are handled: a size
 * field that is octal with NUL/space padding, and a long name stored in a
 * preceding 'L' entry.
 */
import { gunzipSync } from 'node:zlib';

/**
 * Pull one file out of a gzipped tar. npm tarballs are plain ustar with every
 * entry under `package/`, so a full tar implementation is not needed - but the
 * two things that DO bite are handled: a size field that is octal-with-padding,
 * and long names stored in a preceding 'L' entry.
 */
export function readFromTgz(gz, wanted) {
  const buf = gunzipSync(gz);
  let offset = 0;
  let longName = null;

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    // Two consecutive zero blocks end the archive; one is enough to stop here.
    if (header.every((b) => b === 0)) break;

    const rawName = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeField = header.subarray(124, 136).toString('utf8').replace(/[\0 ]/g, '');
    const size = parseInt(sizeField, 8);
    if (!Number.isFinite(size)) throw new Error(`unreadable tar size field "${sizeField}"`);

    const type = String.fromCharCode(header[156]);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (type === 'L') {
      longName = buf.subarray(dataStart, dataEnd).toString('utf8').replace(/\0.*$/, '');
    } else {
      const entryName = longName ?? rawName;
      longName = null;
      if (entryName === wanted) return buf.subarray(dataStart, dataEnd).toString('utf8');
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return null;
}
