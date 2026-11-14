import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicDir = resolve(process.cwd(), 'public');
const readPublic = (name) => readFileSync(resolve(publicDir, name), 'utf8');

describe('TERRA PWA assets and safety', () => {
  it('declares a standalone TERRA app with production entry point and color', () => {
    const manifest = JSON.parse(readPublic('manifest.webmanifest'));
    expect(manifest.name).toBe('TERRA');
    expect(manifest.short_name).toBe('TERRA');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#07111d');
    expect(manifest.background_color).toBe('#07111d');
  });

  it('ships 192px, 512px, and dedicated maskable icons', () => {
    const manifest = JSON.parse(readPublic('manifest.webmanifest'));
    const icon = (size, purpose) => manifest.icons.some((item) => item.sizes === size && item.purpose === purpose);
    expect(icon('192x192', 'any')).toBe(true);
    expect(icon('512x512', 'any')).toBe(true);
    expect(icon('192x192', 'maskable')).toBe(true);
    expect(icon('512x512', 'maskable')).toBe(true);
    for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512]]) {
      const png = readFileSync(resolve(publicDir, name));
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });

  it('caches the shell with version cleanup and bypasses all API traffic', () => {
    const worker = readPublic('sw.js');
    expect(worker).toMatch(/terra-shell-v\d+/);
    expect(worker).toContain("key.startsWith('terra-shell-')");
    expect(worker).toContain("url.pathname.startsWith('/api/')");
    expect(worker).toContain("'/offline.html'");
    expect(worker).toContain('TERRA_SKIP_WAITING');
  });

  it('provides an explicit offline page and update-safe registration', () => {
    expect(readPublic('offline.html')).toContain('live Earth and space data requires an internet connection');
    const registration = readFileSync(resolve(process.cwd(), 'src/registerServiceWorker.js'), 'utf8');
    expect(registration).toContain("updateViaCache: 'none'");
    expect(registration).toContain('terra:sw-update-ready');
  });
});
