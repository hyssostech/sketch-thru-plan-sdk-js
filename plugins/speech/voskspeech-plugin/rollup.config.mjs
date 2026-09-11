import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

const input = 'build/stpvoskspeech.js';

// vosk-browser ships a 5.7 MB UMD file (vosk.js) that includes the WASM runtime.
// We externalize it so our plugin bundle stays small (~20 KB) and vosk.js is loaded
// separately via a <script> tag (exposing the `Vosk` global).
const external = ['vosk-browser'];

export default [
  // UMD bundle (for script tags)
  {
    input,
    external,
    output: {
      file: 'dist/stpvoskspeech-bundle.js',
      format: 'umd',
      name: 'StpVS',
      globals: { 'vosk-browser': 'Vosk' },
      inlineDynamicImports: true,
    },
    plugins: [resolve({ browser: true, preferBuiltins: false }), commonjs()],
  },
  // ESM bundle
  {
    input,
    external,
    output: {
      file: 'dist/stpvoskspeech-bundle.esm.js',
      format: 'esm',
      inlineDynamicImports: true,
    },
    plugins: [resolve({ browser: true, preferBuiltins: false }), commonjs()],
  },
  // Type declarations bundle
  {
    input: 'build/stpvoskspeech.d.ts',
    output: {
      file: 'dist/stpvoskspeech-bundle.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];
