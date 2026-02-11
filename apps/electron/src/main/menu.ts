/**
 * Application menu setup for macOS.
 * Customizes the About menu item to show version details.
 */

import { app, Menu, dialog } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { getAppVersion } from './version';

/**
 * Create and set the application menu.
 * Only creates menu on macOS (Windows/Linux use default menu).
 */
export function setupApplicationMenu(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const appVersion = getAppVersion();

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,  // "flwst" (from package.json name)
      submenu: [
        {
          label: `About ${app.name}`,
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: `About ${app.name}`,
              message: app.name,
              detail: `Version: ${appVersion.version}\nGit SHA: ${appVersion.gitSha}\nBuild: ${appVersion.buildTime.split('T')[0]}\n\nCopyright © 2026 Crescent Wrench Studio`,
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
