/**
 * Auto-update functionality using electron-updater.
 * Checks for updates on app start, logs status, no auto-install yet.
 */

import { autoUpdater } from 'electron-updater';
import { logger } from '@flwst/core';
import { getAppVersion } from './version';

/**
 * Initialize auto-updater and check for updates.
 * Only runs in production environment.
 */
export function initAutoUpdater(): void {
  const appVersion = getAppVersion();

  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // Event listeners
  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates', { currentVersion: appVersion.version });
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available', {
      currentVersion: appVersion.version,
      latestVersion: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('No updates available', {
      currentVersion: appVersion.version,
      latestVersion: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Auto-update error', {
      error: err.message,
      currentVersion: appVersion.version,
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.info('Update download progress', {
      percent: progressObj.percent.toFixed(2),
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  // Check for updates in production only
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        logger.error('Failed to check for updates', { error: err.message });
      });
    }, 3000);
  } else {
    logger.info('Auto-update disabled in development', {
      environment: process.env.NODE_ENV,
    });
  }
}
