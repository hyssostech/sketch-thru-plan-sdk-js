import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';

const input = 'build/awsspeech-plugin/src/stpawsspeech.js';

export default [
  // UMD bundle (for script tags)
  {
    input,
    output: {
      file: 'dist/stpawsspeech-bundle.js',
      format: 'umd',
      name: 'StpAWS',
      inlineDynamicImports: true,
    },
    plugins: [resolve({ browser: true, preferBuiltins: false }), commonjs(), json()],
  },
  // ESM bundle
  {
    input,
    output: {
      file: 'dist/stpawsspeech-bundle.esm.js',
      format: 'esm',
      inlineDynamicImports: true,
    },
    plugins: [resolve({ browser: true, preferBuiltins: false }), commonjs(), json()],
  },
  // Type declarations bundle
  {
    input: 'build/awsspeech-plugin/src/stpawsspeech.d.ts',
    output: {
      file: 'dist/stpawsspeech-bundle.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];
