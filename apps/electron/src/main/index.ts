import { app, ipcMain } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { initSentryMain, getLogger } from './sentry';
import { initializeStorage } from './storage';
import { createMainWindow } from './window';
import {
  enforceSingleInstance,
  registerAppLifecycleHandlers,
} from './lifecycle';
import { registerOnboardingHandlers } from './onboarding';
import { registerNotionHandlers } from './notion';
import { logger } from '@flwst/core';

// Initialize Sentry as early as possible in main process
// In main process, process.env is available
// DSN should be set via environment variable: SENTRY_DSN
// Example: SENTRY_DSN=https://...@o4510755927687168.ingest.us.sentry.io/... pnpm dev:electron
logger.info('Initializing Sentry', {
  dsnConfigured: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
});
initSentryMain(process.env.SENTRY_DSN, process.env.NODE_ENV || 'development');

// Enforce single instance - exit if another instance is running
if (!enforceSingleInstance()) {
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Initialize encrypted storage
  // Stores are now available via getConfigStore() and getTokensStore()
  initializeStorage();

  // Register IPC handlers
  registerOnboardingHandlers();
  registerNotionHandlers();

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => getLogger().info('pong'));

  // Create main window (tracking happens in createMainWindow)
  createMainWindow();

  // Register lifecycle handlers
  registerAppLifecycleHandlers();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
