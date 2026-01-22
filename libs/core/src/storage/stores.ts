/**
 * Encrypted storage stores for user config, tokens, and artifacts.
 * Provides type-safe read/write APIs with automatic encryption/decryption.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { encrypt, decrypt, EncryptionError } from './crypto.js';
import { KeyManager } from './keyManager.js';
import type { UserConfig } from '@flwst/types';
import { UserConfigSchema } from '@flwst/types';

/**
 * Base class for encrypted storage stores.
 */
abstract class EncryptedStore<T> {
  protected storageDir: string;
  protected keyManager: KeyManager;
  protected filename: string;

  constructor(storageDir: string, keyManager: KeyManager, filename: string) {
    this.storageDir = storageDir;
    this.keyManager = keyManager;
    this.filename = filename;
  }

  protected getFilePath(): string {
    return join(this.storageDir, this.filename);
  }

  /**
   * Read and decrypt data from storage.
   */
  protected async readEncrypted(): Promise<string | null> {
    const filePath = this.getFilePath();

    try {
      const encrypted = await readFile(filePath, 'utf8');
      const key = await this.keyManager.getOrCreateKey();
      return decrypt(encrypted, key);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      if (err instanceof EncryptionError) {
        // Corrupted or invalid encryption - return null to fall back to defaults
        return null;
      }
      throw err;
    }
  }

  /**
   * Encrypt and write data to storage.
   */
  protected async writeEncrypted(data: string): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });

    const key = await this.keyManager.getOrCreateKey();
    const encrypted = encrypt(data, key);

    const filePath = this.getFilePath();
    await writeFile(filePath, encrypted, 'utf8');
  }

  /**
   * Get default value when storage is empty or corrupted.
   */
  protected abstract getDefault(): T;

  /**
   * Parse decrypted string into typed object.
   */
  protected abstract parse(data: string): T;

  /**
   * Serialize typed object to string.
   */
  protected abstract serialize(data: T): string;

  /**
   * Read data from storage, falling back to defaults if not found.
   */
  async read(): Promise<T> {
    const decrypted = await this.readEncrypted();

    if (decrypted === null) {
      return this.getDefault();
    }

    try {
      return this.parse(decrypted);
    } catch {
      // Parse failed - return defaults
      return this.getDefault();
    }
  }

  /**
   * Write data to storage.
   */
  async write(data: T): Promise<void> {
    const serialized = this.serialize(data);
    await this.writeEncrypted(serialized);
  }
}

/**
 * Store for user configuration.
 */
export class ConfigStore extends EncryptedStore<UserConfig> {
  constructor(
    storageDir: string,
    keytar: {
      setPassword: (
        service: string,
        account: string,
        password: string,
      ) => Promise<void>;
      getPassword: (service: string, account: string) => Promise<string | null>;
    },
  ) {
    super(storageDir, new KeyManager(keytar), 'config.encrypted');
  }

  protected getDefault(): UserConfig {
    return {
      cleanup: {
        enabled: false,
        ignoreList: [],
        dictionary: {},
      },
      prompts: {
        dailyNote: 'Generate a daily note from the transcript.',
        taskList: 'Extract tasks from the transcript.',
      },
      notion: {},
    };
  }

  protected parse(data: string): UserConfig {
    const parsed = JSON.parse(data);
    return UserConfigSchema.parse(parsed);
  }

  protected serialize(data: UserConfig): string {
    return JSON.stringify(data, null, 2);
  }
}

/**
 * Store for OAuth tokens and Notion IDs.
 */
export class TokensStore extends EncryptedStore<{
  notionAccessToken?: string;
  notionPageId?: string;
  notionDailyNotesDbId?: string;
  notionTodosDbId?: string;
}> {
  constructor(
    storageDir: string,
    keytar: {
      setPassword: (
        service: string,
        account: string,
        password: string,
      ) => Promise<void>;
      getPassword: (service: string, account: string) => Promise<string | null>;
    },
  ) {
    super(storageDir, new KeyManager(keytar), 'tokens.encrypted');
  }

  protected getDefault() {
    return {};
  }

  protected parse(data: string) {
    return JSON.parse(data);
  }

  protected serialize(data: ReturnType<typeof this.getDefault>): string {
    return JSON.stringify(data, null, 2);
  }
}
