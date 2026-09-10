import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Guards the property STP-698 phase 2b established: the plugins consume the
 * SDK's types, so drift between them is a compile error rather than a silent
 * divergence that ships.
 *
 * That property was originally proven by hand - rename a required member of
 * IStpConnector, watch the plugin build fail, revert. A manual proof stops
 * being evidence the moment the session ends. This encodes it.
 *
 * NOTE ON PLACEMENT: this file MUST live at test/*.vitest.ts. The root test
 * script is a bare `vitest run` and vitest.config.ts pins
 * include: ['test/**\/*.vitest.ts'], anchored at the repo root. A test placed
 * under a plugin directory, or named .test.ts / .spec.ts, is never collected -
 * it would pass green having run nothing, which is the exact failure this file
 * exists to prevent.
 */

const ROOT = process.cwd();
const PLUGINS = path.join(ROOT, 'plugins');
const SDK_DTS = path.join(ROOT, 'dist', 'sketch-thru-plan-sdk-bundle.d.ts');

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', 'docs'].includes(entry.name)) continue;
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const pluginSources = walk(PLUGINS);

describe('plugin -> SDK type contract (STP-698 phase 2b)', () => {
  it('runs from the repo root, so the paths below mean what they say', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('sketch-thru-plan-sdk');
    expect(pluginSources.length).toBeGreaterThan(0);
    console.log(
      `[plugin-sdk-contract] root=${pkg.name} plugin source files scanned=${pluginSources.length}`
    );
  });

  it('the SDK type bundle exists - build before testing, or this proves nothing', () => {
    expect(
      fs.existsSync(SDK_DTS),
      `${SDK_DTS} missing. Run "npm run build" first; without it this suite ` +
        'cannot tell a removed export from an unbuilt one.'
    ).toBe(true);
  });

  it('the SDK type bundle is not stale relative to the sources it is built from', () => {
    // Without this, the guard below is really "ci.yml happens to run
    // npm run build before npm test". That is an implicit dependency on a
    // workflow owned by another effort - reordering those steps would silently
    // turn this suite into a check against yesterday's bundle, and whoever
    // reordered them would have no reason to know.
    const built = fs.statSync(SDK_DTS).mtimeMs;
    const sources = walk(path.join(ROOT, 'src'));
    expect(sources.length).toBeGreaterThan(0);

    const newer = sources
      .filter((f) => fs.statSync(f).mtimeMs > built)
      .map((f) => path.relative(ROOT, f));

    expect(
      newer,
      'the built SDK type bundle is older than these sources, so this suite ' +
        'would be checking a stale artifact. Run "npm run build".\n  ' +
        newer.join('\n  ')
    ).toEqual([]);

    console.log(
      `[plugin-sdk-contract] SDK bundle is newer than all ${sources.length} src files`
    );
  });

  it('no plugin keeps its own copy of an SDK interface', () => {
    // Scanned, not enumerated. The earlier version listed four hard-coded
    // paths, so a duplicate reintroduced anywhere else - including beside the
    // source that imports it - passed silently.
    const survivors: string[] = [];
    const scan = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (['node_modules', 'dist', 'build', 'docs'].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.name === 'interfaces') survivors.push(path.relative(ROOT, full));
        else scan(full);
      }
    };
    scan(PLUGINS);

    const SDK_OWNED = ['IStpConnector', 'ISpeechRecognizer', 'IMapAdapter', 'IStpRenderer'];
    const dupes = pluginSources.filter((f) => {
      const t = fs.readFileSync(f, 'utf8');
      return SDK_OWNED.some((n) => new RegExp(`(interface|type)\\s+${n}\\b`).test(t));
    });

    expect(
      survivors,
      'these directories held duplicated interface copies that drifted (one was ' +
        'untouched since 2021-02-17) and must not come back'
    ).toEqual([]);
    expect(
      dupes.map((f) => path.relative(ROOT, f)),
      'these plugin files re-declare a type the SDK owns, which is the drift ' +
        'this phase removed, reintroduced under a different path'
    ).toEqual([]);

    console.log(
      `[plugin-sdk-contract] no interfaces/ dir under plugins; no plugin file redeclares any of ${SDK_OWNED.join(', ')}`
    );
  });

  it('no plugin imports an interface by relative path out of its own tree', () => {
    // Any number of ../ segments, not just two. The earlier version matched the
    // literal '../../interfaces/' only, so '../interfaces/' passed.
    const offenders = pluginSources.filter((f) =>
      /from\s+['"](?:\.\.\/)+[^'"]*interfaces\//.test(fs.readFileSync(f, 'utf8'))
    );
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it('every type a plugin imports from the SDK is actually exported by the SDK', () => {
    const dts = fs.readFileSync(SDK_DTS, 'utf8');
    // Matches `import type { A }`, `import { A }` and `import { type A }`.
    // The earlier version matched only the first form, so a plugin written in
    // either of the others contributed nothing while the suite stayed green -
    // a guard narrower than its own title.
    const importRe =
      /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*['"]sketch-thru-plan-sdk['"]/g;

    // The names the SDK actually EXPORTS, not merely declares. A declaration
    // that is not exported satisfies "is it in the bundle" while being
    // unreachable by any consumer.
    const exported = new Set<string>();
    for (const m of dts.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
      for (const raw of m[1].split(',')) {
        const n = raw.trim().split(/\s+as\s+/).pop()?.trim();
        if (n) exported.add(n);
      }
    }
    for (const m of dts.matchAll(/export\s+(?:declare\s+)?(?:interface|type|class|enum)\s+(\w+)/g)) {
      exported.add(m[1]);
    }

    const required = new Map<string, string[]>();
    for (const file of pluginSources) {
      const text = fs.readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(text)) !== null) {
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0].trim();
          if (!name) continue;
          const seen = required.get(name) ?? [];
          seen.push(path.relative(ROOT, file));
          required.set(name, seen);
        }
      }
    }

    expect(
      required.size,
      'no plugin imports any type from the SDK - either the rewiring was ' +
        'reverted or this scan stopped matching, and either way it is not a pass'
    ).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const [name, users] of required) {
      if (!exported.has(name)) missing.push(`${name} (imported by ${users.join(', ')})`);
    }

    expect(
      missing,
      'these types are imported by plugins but are not declared in the built ' +
        'SDK type bundle, so the SDK has drifted away from its plugins:\n  ' +
        missing.join('\n  ')
    ).toEqual([]);

    console.log(
      `[plugin-sdk-contract] SDK-exported types required by plugins, all present: ` +
        `${[...required.keys()].sort().join(', ')}`
    );
  });

  // The assertion above checks that a NAME exists. It does not check the shape
  // behind the name, and an independent review proved the gap: renaming a
  // member of an SDK interface leaves every assertion above green while the
  // plugins no longer satisfy it. Only a real compile catches that, and no
  // workflow compiled a plugin on push or PR - so "drift is a compile error"
  // was asserted rather than exercised. This exercises it.
  //
  // WHAT THIS CANNOT CATCH, stated so nobody assumes otherwise: DELETING a
  // member from an interface. An implementor is allowed to have members the
  // interface does not declare, so a deletion breaks no plugin. That is a
  // TypeScript rule, not a hole in this check - a deletion is caught only by a
  // caller that used the member.
  it(
    'every plugin still type-checks against the SDK it now imports from',
    () => {
      const tsconfigs = fs
        .readdirSync(PLUGINS, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((group) =>
          fs
            .readdirSync(path.join(PLUGINS, group.name), { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((pkg) => path.join(PLUGINS, group.name, pkg.name, 'tsconfig.json'))
        )
        .filter((f) => fs.existsSync(f));

      expect(
        tsconfigs.length,
        'no plugin tsconfig found - this check would pass having compiled nothing'
      ).toBeGreaterThan(0);

      const failures: string[] = [];
      for (const cfg of tsconfigs) {
        const r = spawnSync('npx', ['tsc', '--noEmit', '-p', cfg], {
          cwd: ROOT,
          encoding: 'utf8',
          shell: true,
        });
        if (r.status !== 0) {
          const firstError =
            (r.stdout || '').split('\n').find((l) => l.includes('error TS')) ?? '';
          failures.push(`${path.relative(ROOT, cfg)} -> exit ${r.status} ${firstError.trim()}`);
        }
      }

      expect(
        failures,
        'these plugins no longer compile against the SDK, which is exactly the ' +
          'drift this phase exists to make loud:\n  ' + failures.join('\n  ')
      ).toEqual([]);

      console.log(
        `[plugin-sdk-contract] tsc --noEmit clean for all ${tsconfigs.length} plugins`
      );
    },
    180000
  );
});
