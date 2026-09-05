import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname),
  server: {
    fs: {
      // allow importing files from the monorepo root
      allow: [path.resolve(__dirname, '../../..')]
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
