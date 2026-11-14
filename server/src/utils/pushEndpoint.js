const exactPushHosts = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

export function isSupportedPushEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const supportedHost = exactPushHosts.has(hostname) || hostname.endsWith('.notify.windows.com');
  return url.protocol === 'https:'
    && !url.username
    && !url.password
    && !url.port
    && !url.hash
    && supportedHost;
}
