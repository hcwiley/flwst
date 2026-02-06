/**
 * Bootstrap Notion sync on app launch when Notion is ready.
 * Fetches tasks and daily notes and pushes result to renderer via notion:syncComplete.
 */

import { BrowserWindow } from 'electron';
import { getLogger } from '../sentry';
import { getConfigStore } from '../storage';
import { runSync } from './sync';

const logger = getLogger();

/** Notion statuses that have resources and can sync. */
const SYNCABLE_STATUSES = new Set(['ready', 'resources_created']);

/**
 * Run sync when Notion has resources (ready or resources_created) and push result to all windows.
 * Called after app is ready and main window is created.
 */
export async function runBootstrapSync(): Promise<void> {
  try {
    const configStore = getConfigStore();
    const config = await configStore.read();
    const status = config.onboardingState?.notion?.status;
    if (!status || !SYNCABLE_STATUSES.has(status)) {
      logger.debug('Bootstrap sync skipped', { status });
      return;
    }

    logger.info('Bootstrap Notion sync starting');
    const result = await runSync();
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('notion:syncComplete', {
        success: true,
        tasks: result.tasks,
        notes: result.notes,
      });
    });
    logger.info('Bootstrap Notion sync completed', {
      tasksCount: result.tasks.length,
      notesCount: result.notes.length,
    });
  } catch (error) {
    logger.error('Bootstrap Notion sync failed', { error });
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('notion:syncComplete', {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
