import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

/** Directories that held duplicated copies of the SDK's interfaces. */
const RETIRED_INTERFACE_DIRS = [
  'plugins/connectors/interfaces',
  'plugins/speech/interfaces',
  'plugins/maps/interfaces',
  'plugins/renderers/interfaces',
];

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

  it('no plugin keeps its own copy of an SDK interface', () => {
    const survivors = RETIRED_INTERFACE_DIRS.filter((d) => fs.existsSync(path.join(ROOT, d)));
    expect(
      survivors,
      `these directories held duplicated interface copies that drifted (one was ` +
        `untouched since 2021-02-17) and must not come back: ${survivors.join(', ')}`
    ).toEqual([]);
    console.log(
      `[plugin-sdk-contract] retired interface dirs still absent: ${RETIRED_INTERFACE_DIRS.length}/${RETIRED_INTERFACE_DIRS.length}`
    );
  });

  it('no plugin imports an interface by relative path out of its own tree', () => {
    const offenders = pluginSources.filter((f) =>
      /from\s+['"]\.\.\/\.\.\/interfaces\//.test(fs.readFileSync(f, 'utf8'))
    );
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it('every type a plugin imports from the SDK is actually exported by the SDK', () => {
    const dts = fs.readFileSync(SDK_DTS, 'utf8');
    const importRe = /import\s+type\s*\{([^}]+)\}\s*from\s*['"]sketch-thru-plan-sdk['"]/g;

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
      const declared = new RegExp(`\\b(interface|type|class|enum)\\s+${name}\\b`).test(dts);
      if (!declared) missing.push(`${name} (imported by ${users.join(', ')})`);
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
});
