import './resource-path';
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
import { registerConfigHandlers } from './config';
import {
  checkNotionSchemasOnStartup,
  registerNotionHandlers,
  runBootstrapSync,
} from './notion';
import { logger } from '@flwst/core';
import { registerInboxHandlers } from './inbox';
import { registerLlmHandlers } from './llm';
import { registerArtifactHandlers } from './artifacts';
import { isPreflightCompleted, registerPreflightHandlers } from './preflight';

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

  // Register preflight handlers first (before storage init)
  // This allows the renderer to check/complete preflight
  registerPreflightHandlers();

  // Initialize encrypted storage only if preflight already completed
  // Otherwise, storage will be initialized when preflight:complete is called
  if (isPreflightCompleted()) {
    initializeStorage();
  }

  // Register IPC handlers (they guard against uninitialized storage)
  registerOnboardingHandlers();
  registerConfigHandlers();
  registerInboxHandlers();
  registerLlmHandlers();
  registerArtifactHandlers();
  registerNotionHandlers();

  // Only run startup checks if storage is initialized
  if (isPreflightCompleted()) {
    checkNotionSchemasOnStartup().catch((error) => {
      getLogger().error('Notion schema check failed', { error });
    });
  }

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

  // Bootstrap Notion sync when notion.status === 'ready' (only if preflight done)
  if (isPreflightCompleted()) {
    runBootstrapSync().catch((err) =>
      getLogger().error('Bootstrap sync failed', { err }),
    );
  }

  // Register lifecycle handlers
  registerAppLifecycleHandlers();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
