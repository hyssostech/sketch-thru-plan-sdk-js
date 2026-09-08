import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
  // tsc's rootDir is inferred from ALL inputs, and this plugin imports
  // ../../interfaces/IStpRenderer, so the emitted tree is nested under
  // build/milsymts/src/ rather than flat in build/. The sibling arcgis plugin
  // already points at its nested path; leaflet and googlemaps sidestep this by
  // passing explicit paths in their package scripts instead of using a config.
  input: 'build/milsymts/src/milsymtsrenderer.js',
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
