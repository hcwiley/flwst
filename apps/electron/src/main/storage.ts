/**
 * Storage initialization for Electron main process.
 * Sets up encrypted storage with OS keychain integration.
 */

import keytar from 'keytar';
import { app } from 'electron';
import { join } from 'node:path';
import { ConfigStore, TokensStore } from '@flwst/core';

/**
 * Initialize encrypted storage stores.
 * Should be called during app startup.
 * Uses Electron's app.getPath('userData') for the storage directory.
 */
export function initializeStorage() {
  // Use Electron's userData directory for storage
  const userDataPath = app.getPath('userData');
  const storageDir = join(userDataPath, 'storage');

  // Ensure storage directory exists
  const configStore = new ConfigStore(storageDir, keytar);
  const tokensStore = new TokensStore(storageDir, keytar);

  return {
    configStore,
    tokensStore,
  };
}
