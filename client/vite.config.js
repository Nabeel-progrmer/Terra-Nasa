import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const clientDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const cesiumPackageDirectory = path.dirname(require.resolve('cesium/package.json'));
const cesiumBuildDirectory = path.join(cesiumPackageDirectory, 'Build');
const cesiumBaseUrl = '/cesium/';
const apiTarget = process.env.TERRA_API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [
    react(),
    cesium({
      rebuildCesium: true,
      cesiumBuildRootPath: cesiumBuildDirectory,
      cesiumBuildPath: path.join(cesiumBuildDirectory, 'Cesium'),
      cesiumBaseUrl,
    }),
  ],
  build: {
    outDir: 'dist',
    manifest: 'terra-build-manifest.json',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](?:cesium|@cesium)[\\/]/.test(id)) return 'cesium';
        },
      },
    },
  },
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
