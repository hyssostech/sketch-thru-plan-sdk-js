import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
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
