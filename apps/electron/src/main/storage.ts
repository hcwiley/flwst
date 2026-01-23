/**
 * Storage initialization for Electron main process.
 * Sets up encrypted storage with OS keychain integration.
 */

import keytar from 'keytar';
import { app } from 'electron';
import { join } from 'node:path';
import { ConfigStore, TokensStore } from '@flwst/core';

/**
 * Module-level storage stores.
 * Initialized by initializeStorage() and accessible via getters.
 */
let configStore: ConfigStore | null = null;
let tokensStore: TokensStore | null = null;

/**
 * Initialize encrypted storage stores.
 * Should be called during app startup.
 * Uses Electron's app.getPath('userData') for the storage directory.
 */
export function initializeStorage(): void {
  // Use Electron's userData directory for storage
  const userDataPath = app.getPath('userData');
  const storageDir = join(userDataPath, 'storage');

  // Create and store the stores for IPC handler access
  configStore = new ConfigStore(storageDir, keytar);
  tokensStore = new TokensStore(storageDir, keytar);
}

/**
 * Get the config store instance.
 * Throws if storage has not been initialized.
 *
 * @returns The ConfigStore instance
 * @throws Error if storage has not been initialized
 */
export function getConfigStore(): ConfigStore {
  if (configStore === null) {
    throw new Error(
      'ConfigStore not initialized. Call initializeStorage() first.',
    );
  }
  return configStore;
}

/**
 * Get the tokens store instance.
 * Throws if storage has not been initialized.
 *
 * @returns The TokensStore instance
 * @throws Error if storage has not been initialized
 */
export function getTokensStore(): TokensStore {
  if (tokensStore === null) {
    throw new Error(
      'TokensStore not initialized. Call initializeStorage() first.',
    );
  }
  return tokensStore;
}
