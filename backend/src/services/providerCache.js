const entries = new Map();
const MAX_ENTRIES = 200;

export async function cached(key, ttlSeconds, loader) {
  if (ttlSeconds <= 0) return loader();
  const now = Date.now();
  const existing = entries.get(key);
  if (existing?.expiresAt > now) return existing.promise;
  if (existing) entries.delete(key);

  const promise = Promise.resolve().then(loader).catch((error) => {
    entries.delete(key);
    throw error;
  });
  entries.set(key, { expiresAt: now + ttlSeconds * 1000, promise });
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
  return promise;
}

export function clearProviderCache() {
  entries.clear();
}
