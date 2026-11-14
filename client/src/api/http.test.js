import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('apiUrl', () => {
  it('uses the relative API path when no production origin is configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { apiUrl } = await import('./http.js');
    expect(apiUrl('/api/weather')).toBe('/api/weather');
  });

  it('joins a configured API origin without duplicate slashes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test///');
    const { apiFetch, apiUrl } = await import('./http.js');
    expect(apiUrl('/api/weather?latitude=1&longitude=2')).toBe('https://api.example.test/api/weather?latitude=1&longitude=2');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/api/auth/me');
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/auth/me', { credentials: 'include' });
  });

  it('rejects paths that are not rooted at the API origin', async () => {
    const { apiUrl } = await import('./http.js');
    expect(() => apiUrl('api/weather')).toThrow('TERRA API paths must start with /.');
  });
});
