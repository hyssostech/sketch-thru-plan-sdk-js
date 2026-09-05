import terser from '@rollup/plugin-terser';

export default {
  input: 'build/googlemaps.js',
  output: [
    {
      file: 'dist/googlemaps-bundle.js',
      format: 'iife',
      name: 'GoogleMapsPlugin'
    },
    {
      file: 'dist/googlemaps-bundle-min.js',
      format: 'iife',
      name: 'GoogleMapsPlugin',
      plugins: [terser()]
    }
  ]
};
