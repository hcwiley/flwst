/**
 * Encrypted storage stores for user config, tokens, and artifacts.
 * Provides type-safe read/write APIs with automatic encryption/decryption.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { encrypt, decrypt, EncryptionError } from './crypto';
import { KeyManager } from './keyManager';
import type { UserConfig, Tokens } from '@flwst/types';
import { UserConfigSchema, TokensSchema } from '@flwst/types';

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
      preprocess: {
        enabled: false,
        ignoreList: [],
        dictionary: {},
      },
      prompts: {},
      notion: {},
      onboardingState: undefined,
      kanbanPrefs: {
        sortKey: 'name',
        sortDir: 'asc',
        visibleStatuses: [
          'Backlog',
          'To-do',
          'On Deck',
          'In progress',
          'BLOCKED',
          'Done',
          'Cancelled',
        ],
      },
    };
  }

  protected parse(data: string): UserConfig {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    // Migrate legacy cleanup → preprocess
    if (parsed.cleanup != null && parsed.preprocess == null) {
      parsed.preprocess = parsed.cleanup;
      delete parsed.cleanup;
    }
    // Migrate prompts shape: taskList → taskDraft, drop cleanup prompt
    if (parsed.prompts != null && typeof parsed.prompts === 'object') {
      const p = parsed.prompts as Record<string, unknown>;
      if (p.taskList != null && p.taskDraft == null) {
        p.taskDraft = p.taskList;
        delete p.taskList;
      }
      delete p.cleanup;
    }
    return UserConfigSchema.parse(parsed);
  }

  protected serialize(data: UserConfig): string {
    return JSON.stringify(data, null, 2);
  }
}

/**
 * Store for OAuth tokens and Notion IDs.
 */
export class TokensStore extends EncryptedStore<Tokens> {
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

  protected getDefault(): Tokens {
    return {};
  }

  protected parse(data: string): Tokens {
    const parsed = JSON.parse(data);
    return TokensSchema.parse(parsed);
  }

  protected serialize(data: Tokens): string {
    return JSON.stringify(data, null, 2);
  }
}
