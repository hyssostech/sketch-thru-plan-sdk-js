import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
  // tsc's rootDir is inferred from the input files being compiled; since this
  // plugin's only inputs live under src/, the emitted tree is flat in build/.
  input: 'build/milsymtsrenderer.js',
  output: [
    {
      file: 'dist/milsymtsrenderer-bundle.js',
      format: 'iife',
      name: 'MilsymTsRenderer'
    },
    {
      file: 'dist/milsymtsrenderer-bundle.min.js',
      format: 'iife',
      name: 'MilsymTsRenderer',
      plugins: [terser()]
    },
    {
      file: 'dist/milsymtsrenderer.esm.js',
      format: 'esm'
    }
  ],
  plugins: [
    resolve(),
    commonjs()
  ]
};
