import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(clientDirectory, '../dist');
const cesiumDirectory = path.join(outputDirectory, 'cesium');
const requiredDirectories = ['Assets', 'ThirdParty', 'Workers', 'Widgets'];
const missing = requiredDirectories.filter((directory) => {
  const directoryPath = path.join(cesiumDirectory, directory);
  return !existsSync(directoryPath) || readdirSync(directoryPath).length === 0;
});

if (missing.length) {
  console.error(`Cesium assets missing or empty in ${cesiumDirectory}: ${missing.join(', ')}`);
  process.exit(1);
}

const widgetsCss = path.join(cesiumDirectory, 'Widgets', 'widgets.css');
const html = readFileSync(path.join(outputDirectory, 'index.html'), 'utf8');
const hasCesiumBaseUrl = readdirSync(path.join(outputDirectory, 'assets'))
  .filter((file) => file.endsWith('.js'))
  .some((file) => readFileSync(path.join(outputDirectory, 'assets', file), 'utf8').includes('/cesium/'));

if (!existsSync(widgetsCss) || !html.includes('/cesium/Widgets/widgets.css') || !hasCesiumBaseUrl) {
  console.error('Cesium Widgets stylesheet or /cesium/ runtime base URL was not emitted correctly.');
  process.exit(1);
}

console.log('Verified Cesium Assets, ThirdParty, Workers, Widgets, Widgets CSS, and /cesium/ runtime base URL.');
