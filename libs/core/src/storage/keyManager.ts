/**
 * Key manager for secure key storage using OS keychain.
 * Creates and retrieves a 256-bit encryption key from the system keychain.
 */

import crypto from 'node:crypto';

/**
 * Service name for keychain storage.
 */
const KEYCHAIN_SERVICE = 'com.flowstate.app';
const KEYCHAIN_ACCOUNT = 'encryption-key';

/**
 * Key manager that uses OS keychain to store encryption keys.
 */
export class KeyManager {
  private keytar: {
    setPassword: (
      service: string,
      account: string,
      password: string,
    ) => Promise<void>;
    getPassword: (service: string, account: string) => Promise<string | null>;
  };

  constructor(keytar: {
    setPassword: (
      service: string,
      account: string,
      password: string,
    ) => Promise<void>;
    getPassword: (service: string, account: string) => Promise<string | null>;
  }) {
    this.keytar = keytar;
  }

  /**
   * Get or create the encryption key from keychain.
   * Creates a new 256-bit key if one doesn't exist, otherwise returns the existing key.
   *
   * @returns 32-byte (256-bit) encryption key
   */
  async getOrCreateKey(): Promise<Buffer> {
    // Try to get existing key
    const existingKey = await this.keytar.getPassword(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT,
    );

    if (existingKey) {
      return Buffer.from(existingKey, 'base64');
    }

    // Create new key
    const newKey = crypto.randomBytes(32);

    // Store in keychain as base64
    await this.keytar.setPassword(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT,
      newKey.toString('base64'),
    );

    return newKey;
  }
}
