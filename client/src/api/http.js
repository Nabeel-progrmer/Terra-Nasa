const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';
// The monorepo Vercel deployment serves /api through api/[...path].js, and
// local Vite proxies /api to the development server. Separate frontend hosts
// can set VITE_API_BASE_URL to their backend origin at build time.
const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, '');

export function apiUrl(path) {
  if (!path.startsWith('/')) throw new TypeError('TERRA API paths must start with /.');
  return `${apiBaseUrl}${path}`;
}

export function apiFetch(path, options) {
  const url = apiUrl(path);
  if (!apiBaseUrl) return options ? fetch(url, options) : fetch(url);
  const requestOptions = { ...options, credentials: 'include' };
  return fetch(url, requestOptions);
}
