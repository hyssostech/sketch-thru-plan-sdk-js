import dts from 'rollup-plugin-dts';

export default [
  {
    input: 'build/arcgis.js',
    output: {
      file: 'dist/arcgis-bundle.js',
      format: 'umd',
      name: 'ArcGISMap'
    }
  },
  {
    input: 'build/arcgis.js',
    output: {
      file: 'dist/arcgis-bundle.esm.js',
      format: 'esm'
    }
  },
  {
    input: 'build/arcgis.d.ts',
    output: {
      file: 'dist/arcgis-bundle.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];
