/**
 * Window management utilities for Electron main process.
 * Centralizes window creation and configuration.
 */

import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { getLogger } from './sentry';
import icon from '../../resources/icon.png?asset';
import { setMainWindow } from './lifecycle';

/**
 * Window configuration options.
 */
export interface WindowOptions {
  width?: number;
  height?: number;
  show?: boolean;
  preloadPath: string;
}

/**
 * Default window options.
 */
const DEFAULT_WINDOW_OPTIONS: WindowOptions = {
  width: 900,
  height: 670,
  show: false,
  preloadPath: join(__dirname, '../preload/index.js'),
};

/**
 * Create the main application window.
 *
 * @param options - Window configuration options
 * @returns The created BrowserWindow instance
 */
export function createMainWindow(
  options: Partial<WindowOptions> = {},
): BrowserWindow {
  const opts = { ...DEFAULT_WINDOW_OPTIONS, ...options };

  const mainWindow = new BrowserWindow({
    width: opts.width,
    height: opts.height,
    show: opts.show,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: opts.preloadPath,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    // Open DevTools in development to see any errors
    if (is.dev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Log renderer process errors
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription) => {
      getLogger().error('Renderer failed to load', {
        errorCode,
        errorDescription,
      });
    },
  );

  mainWindow.webContents.on('render-process-gone', () => {
    getLogger().error('Renderer process crashed');
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Track the main window for lifecycle management
  setMainWindow(mainWindow);

  return mainWindow;
}
