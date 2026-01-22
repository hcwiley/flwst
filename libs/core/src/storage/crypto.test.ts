/**
 * Unit tests for encryption/decryption utilities.
 * Tests AES-GCM encryption with random IVs and authentication.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { encrypt, decrypt, EncryptionError } from './crypto';

test('encrypt and decrypt round-trip with valid data', () => {
  const key = Buffer.from('a'.repeat(32), 'utf8'); // 256-bit key
  const plaintext = 'sensitive data';

  const encrypted = encrypt(plaintext, key);
  const decrypted = decrypt(encrypted, key);

  assert.equal(decrypted, plaintext);
  assert.notEqual(encrypted, plaintext);
});

test('encrypt produces different output for same input (IV randomness)', () => {
  const key = Buffer.from('a'.repeat(32), 'utf8');
  const plaintext = 'same input';

  const encrypted1 = encrypt(plaintext, key);
  const encrypted2 = encrypt(plaintext, key);

  // Should be different due to random IV
  assert.notEqual(encrypted1, encrypted2);

  // But both should decrypt to the same value
  assert.equal(decrypt(encrypted1, key), plaintext);
  assert.equal(decrypt(encrypted2, key), plaintext);
});

test('decrypt rejects invalid auth tag', () => {
  const key = Buffer.from('a'.repeat(32), 'utf8');
  const validEncrypted = encrypt('test', key);

  // Corrupt the auth tag (last 16 bytes)
  const corrupted = Buffer.from(validEncrypted);
  corrupted[corrupted.length - 1] ^= 0xff;

  assert.throws(
    () => decrypt(corrupted.toString('base64'), key),
    (err: unknown) =>
      err instanceof EncryptionError && /authentication/i.test(err.message),
  );
});

test('decrypt rejects wrong key', () => {
  const key1 = Buffer.from('a'.repeat(32), 'utf8');
  const key2 = Buffer.from('b'.repeat(32), 'utf8');
  const plaintext = 'test data';

  const encrypted = encrypt(plaintext, key1);

  assert.throws(
    () => decrypt(encrypted, key2),
    (err: unknown) => err instanceof EncryptionError,
  );
});

test('decrypt rejects malformed encrypted data', () => {
  const key = Buffer.from('a'.repeat(32), 'utf8');

  assert.throws(
    () => decrypt('not-valid-base64', key),
    (err: unknown) => err instanceof EncryptionError,
  );

  assert.throws(
    () => decrypt('dGVzdA==', key), // valid base64 but too short
    (err: unknown) => err instanceof EncryptionError,
  );
});
