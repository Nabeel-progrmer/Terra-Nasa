const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const productionApiUrl = 'https://terra-nasa-1.onrender.com';
// Local Vite uses its /api proxy. Production defaults to the live Render API;
// deployments with a different API can override it through VITE_API_BASE_URL.
const apiBaseUrl = (configuredBaseUrl || (import.meta.env.PROD ? productionApiUrl : '')).replace(/\/+$/, '');

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
