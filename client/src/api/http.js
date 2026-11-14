const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';
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
