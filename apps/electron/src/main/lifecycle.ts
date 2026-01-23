/**
 * Application lifecycle handlers for Electron.
 * Manages app activation, window focus, and single-instance locking.
 */

import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;

/**
 * Register application lifecycle event handlers.
 * Should be called after app.whenReady().
 */
export function registerAppLifecycleHandlers(): void {
  // Handle macOS app activation (dock icon click)
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      // Focus existing window
      mainWindow.focus();
    } else {
      // Window was destroyed, create a new one
      mainWindow = createMainWindow();
    }
  });

  // Quit when all windows are closed, except on macOS.
  // On macOS, it's common for applications and their menu bar to stay active
  // until the user quits explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

/**
 * Enforce single instance of the application.
 * If another instance is launched, focus the existing window instead.
 *
 * @returns true if this is the primary instance, false if another instance exists
 */
export function enforceSingleInstance(): boolean {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    // Another instance is already running - focus it and quit this one
    app.quit();
    return false;
  }

  // Handle second instance launch - focus existing window
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    } else {
      // Window was destroyed (e.g., closed on macOS), create a new one
      mainWindow = createMainWindow();
    }
  });

  return true;
}

/**
 * Set the main window reference.
 * Used to track the primary window for lifecycle management.
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}
