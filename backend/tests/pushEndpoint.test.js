import { describe, expect, it } from 'vitest';
import { isSupportedPushEndpoint } from '../src/utils/pushEndpoint.js';

describe('isSupportedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/example-token',
    'https://updates.push.services.mozilla.com/wpush/v2/example-token',
    'https://web.push.apple.com/QWERTY',
    'https://wns2-example.notify.windows.com/w/?token=example',
  ])('allows supported HTTPS push endpoint %s', (endpoint) => {
    expect(isSupportedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    'https://attacker.example/push',
    'https://fcm.googleapis.com.attacker.example/push',
    'https://user@fcm.googleapis.com/push',
    'https://fcm.googleapis.com:8443/push',
    'http://fcm.googleapis.com/push',
    'https://127.0.0.1/push',
  ])('rejects unsupported endpoint %s', (endpoint) => {
    expect(isSupportedPushEndpoint(endpoint)).toBe(false);
  });
});
