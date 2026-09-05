import terser from '@rollup/plugin-terser';

export default {
  input: 'build/leaflet.js',
  external: ['leaflet'],
  output: [
    {
      file: 'dist/leaflet-bundle.js',
      format: 'iife',
      name: 'LeafletMapsPlugin',
      globals: { leaflet: 'L' }
    },
    {
      file: 'dist/leaflet-bundle-min.js',
      format: 'iife',
      name: 'LeafletMapsPlugin',
      globals: { leaflet: 'L' },
      plugins: [terser()]
    }
  ]
};
