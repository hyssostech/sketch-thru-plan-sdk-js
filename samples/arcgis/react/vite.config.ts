import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

// Absolute paths to local SDK bundles that live outside the Vite root
const sdkRoot = path.resolve(__dirname, '../../..');          // sketch-thru-plan-sdk-js
const workspaceRoot = path.resolve(__dirname, '../../../..'); // JS/

/**
 * Tiny Vite plugin that maps virtual URL prefixes to local files so that
 * <script src="/local/..."> tags in index.html resolve correctly during dev.
 */
function serveLocalBundles(): Plugin {
  const aliases: Record<string, string> = {
    '/local/arcgisserver-bundle-min.js': path.join(
      sdkRoot, 'plugins/maps/arcgisserver/dist/arcgisserver-bundle-min.js'
    ),
    '/local/sketch-thru-plan-sdk-bundle-min.js': path.join(
      workspaceRoot, 'stp-js/dist/sketch-thru-plan-sdk-bundle-min.js'
    ),
  };

  return {
    name: 'serve-local-bundles',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = aliases[req.url!];
        if (file && fs.existsSync(file)) {
          res.setHeader('Content-Type', 'application/javascript');
          fs.createReadStream(file).pipe(res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react(), serveLocalBundles()],
  server: {
    fs: {
      // allow importing files from the monorepo root
      allow: [workspaceRoot]
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
