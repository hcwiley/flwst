/**
 * Version information utilities for main process.
 */

import { ipcMain } from 'electron';
import type { AppVersion } from '@flwst/types';

/**
 * Get application version information from build-time environment variables.
 */
export function getAppVersion(): AppVersion {
  return {
    version: process.env.APP_VERSION || '0.0.0',
    gitSha: process.env.APP_GIT_SHA || 'unknown',
    buildTime: process.env.APP_BUILD_TIME || new Date().toISOString(),
    formatted: process.env.APP_VERSION_FORMATTED || 'Unknown version',
  };
}

/**
 * Register IPC handlers for version information.
 */
export function registerVersionHandlers(): void {
  ipcMain.handle('app:getVersion', (): AppVersion => {
    return getAppVersion();
  });
}
