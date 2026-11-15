import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/security/passwords.js';

describe('account password hashing', () => {
  it('stores a salted scrypt hash and verifies only the matching password', async () => {
    const encoded = await hashPassword('a long test password');
    expect(encoded).not.toContain('a long test password');
    expect(encoded).toMatch(/^[a-f0-9]{32}:[a-f0-9]{128}$/);
    await expect(verifyPassword('a long test password', encoded)).resolves.toBe(true);
    await expect(verifyPassword('a different password', encoded)).resolves.toBe(false);
  });

  it('rejects malformed stored hashes safely', async () => {
    await expect(verifyPassword('any password', 'not-a-hash')).resolves.toBe(false);
  });
});
