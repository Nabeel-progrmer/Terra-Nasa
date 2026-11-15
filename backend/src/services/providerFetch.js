import env from '../config/env.js';

export async function fetchJson(url, { timeoutMs = env.PROVIDER_TIMEOUT_MS, headers = {} } = {}) {
  const response = await fetch(url, {
    headers: { accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const error = new Error(`Data provider returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  try {
    return await response.json();
  } catch {
    const error = new Error('Data provider returned invalid JSON.');
    error.status = 502;
    throw error;
  }
}
