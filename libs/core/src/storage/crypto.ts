/**
 * Encryption utilities for secure local storage.
 * Uses AES-256-GCM for authenticated encryption with random IVs.
 */

import crypto from 'node:crypto';

/**
 * Error thrown when encryption/decryption fails.
 */
export class EncryptionError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'EncryptionError';
    this.cause = cause;
  }
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string containing IV, auth tag, and ciphertext.
 *
 * @param plaintext - Data to encrypt
 * @param key - 256-bit (32-byte) encryption key
 * @returns Base64-encoded encrypted data
 */
export function encrypt(plaintext: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new EncryptionError('Key must be exactly 32 bytes (256 bits)');
  }

  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: IV (12 bytes) + ciphertext + auth tag (16 bytes)
  const result = Buffer.concat([iv, encrypted, authTag]);

  return result.toString('base64');
}

/**
 * Decrypt base64-encoded encrypted data using AES-256-GCM.
 *
 * @param encrypted - Base64-encoded encrypted data
 * @param key - 256-bit (32-byte) decryption key
 * @returns Decrypted plaintext
 * @throws EncryptionError if decryption fails (wrong key, corrupted data, etc.)
 */
export function decrypt(encrypted: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new EncryptionError('Key must be exactly 32 bytes (256 bits)');
  }

  let data: Buffer;
  try {
    data = Buffer.from(encrypted, 'base64');
  } catch (err) {
    throw new EncryptionError('Invalid base64 data', err as Error);
  }

  // Need at least IV (12) + auth tag (16) = 28 bytes
  if (data.length < 28) {
    throw new EncryptionError('Encrypted data too short');
  }

  const iv = data.subarray(0, 12);
  const authTag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(12, data.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    throw new EncryptionError(
      'Decryption failed: authentication tag mismatch or corrupted data',
      err as Error,
    );
  }
}
