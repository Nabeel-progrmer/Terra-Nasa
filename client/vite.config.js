import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDirectory = path.dirname(fileURLToPath(import.meta.url));
const cesiumBuildDirectory = path.resolve(clientDirectory, '../node_modules/cesium/Build');
const apiTarget = process.env.TERRA_API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react(), cesium({
    rebuildCesium: true,
    cesiumBuildRootPath: cesiumBuildDirectory,
    cesiumBuildPath: path.join(cesiumBuildDirectory, 'Cesium'),
  })],
  build: { manifest: 'terra-build-manifest.json' },
  server: {
    port: Number(process.env.TERRA_WEB_PORT) || 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': apiTarget,
    },
  },
  preview: {
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
