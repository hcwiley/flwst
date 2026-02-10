/**
 * Key manager for secure key storage using OS keychain.
 * Creates and retrieves a 256-bit encryption key from the system keychain.
 */

import crypto from 'node:crypto';

const KEYCHAIN_ACCOUNT = 'encryption-key';

/**
 * Mutex promise for key creation to prevent race conditions.
 * Shared across all KeyManager instances since they use the same keychain entry.
 */
let keyCreationLock: Promise<Buffer> | null = null;

/**
 * Keychain adapter interface used by KeyManager.
 */
export interface KeytarAdapter {
  setPassword: (
    service: string,
    account: string,
    password: string,
  ) => Promise<void>;
  getPassword: (service: string, account: string) => Promise<string | null>;
}

/**
 * Key manager that uses OS keychain to store encryption keys.
 */
export class KeyManager {
  private keytar: KeytarAdapter;
  private service: string;

  /**
   * @param keytar - Keychain adapter (e.g., node-keytar)
   * @param service - Service name for keychain storage (e.g., app bundle ID)
   */
  constructor(keytar: KeytarAdapter, service: string) {
    this.keytar = keytar;
    this.service = service;
  }

  /**
   * Get or create the encryption key from keychain.
   * Creates a new 256-bit key if one doesn't exist, otherwise returns the existing key.
   * Uses a mutex to prevent race conditions when multiple callers try to create the key concurrently.
   *
   * @returns 32-byte (256-bit) encryption key
   */
  async getOrCreateKey(): Promise<Buffer> {
    // Try to get existing key
    const existingKey = await this.keytar.getPassword(
      this.service,
      KEYCHAIN_ACCOUNT,
    );

    if (existingKey) {
      return Buffer.from(existingKey, 'base64');
    }

    // If key creation is in progress, wait for it and return the result
    if (keyCreationLock) {
      return keyCreationLock;
    }

    // Create new key with mutex protection
    keyCreationLock = (async () => {
      try {
        // Double-check after acquiring lock (another caller may have created it)
        const doubleCheckKey = await this.keytar.getPassword(
          this.service,
          KEYCHAIN_ACCOUNT,
        );
        if (doubleCheckKey) {
          return Buffer.from(doubleCheckKey, 'base64');
        }

        // Create new key
        const newKey = crypto.randomBytes(32);

        // Store in keychain as base64
        await this.keytar.setPassword(
          this.service,
          KEYCHAIN_ACCOUNT,
          newKey.toString('base64'),
        );

        return newKey;
      } finally {
        // Clear the lock when done
        keyCreationLock = null;
      }
    })();

    return keyCreationLock;
  }
}
