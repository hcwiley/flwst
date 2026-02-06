/**
 * Notion IPC handlers registration.
 * Registers all Electron IPC handlers for Notion integration.
 */

import { ipcMain, shell, BrowserWindow } from 'electron';
import type { NotionWorkspaceMetadata } from '@flwst/types';
import { getLogger } from '../sentry';
import { getConfigStore, getTokensStore } from '../storage';
import { completeNotionOAuth } from './notionOAuth';
import { normalizeNotionId } from './notionSchema';
import { toNotionError } from './errors';
import { getOrCreateResources } from './resources';
import { NotionError } from './errors';
import { runSync, runTasksSync } from './sync';
import { publishDrafts } from './publish';
import type { PublishPayload } from '@flwst/types';

const logger = getLogger();

/**
 * Helper to store OAuth result in tokens and onboarding state.
 */
async function handleOAuthResult(result: {
  accessToken: string;
  workspace: NotionWorkspaceMetadata;
}): Promise<void> {
  const tokensStore = getTokensStore();
  const currentTokens = await tokensStore.read();
  await tokensStore.write({
    ...currentTokens,
    notionAccessToken: result.accessToken,
  });

  const configStore = getConfigStore();
  const currentState = await configStore.read();
  const currentOnboarding = currentState.onboardingState;
  if (currentOnboarding) {
    await configStore.write({
      ...currentState,
      onboardingState: {
        ...currentOnboarding,
        notion: {
          ...currentOnboarding.notion,
          status: 'authed',
          workspace: result.workspace,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }
}

/**
 * Register Notion IPC handlers.
 * Should be called after storage is initialized.
 */
export function registerNotionHandlers(): void {
  // Start Notion OAuth - opens browser and handles callback
  ipcMain.handle(
    'notion:startOAuth',
    async (): Promise<{ authUrl: string }> => {
      try {
        const { authUrl, result } = await completeNotionOAuth();

        logger.info('Starting Notion OAuth', {
          authUrl: authUrl.replace(process.env.NOTION_CLIENT_ID || '', '***'),
        });

        // Start OAuth flow in background (will handle callback)
        result
          .then(async (oauthResult) => {
            // Store OAuth result
            await handleOAuthResult(oauthResult);
            logger.info('Notion OAuth completed and stored');

            // Notify renderer that OAuth completed
            // Get all windows and send event
            const { BrowserWindow } = await import('electron');
            BrowserWindow.getAllWindows().forEach((window) => {
              window.webContents.send('notion:oauthComplete', {
                success: true,
              });
            });
          })
          .catch((error) => {
            logger.error('Notion OAuth failed', { error });

            // Notify renderer of OAuth failure
            import('electron').then(({ BrowserWindow }) => {
              BrowserWindow.getAllWindows().forEach((window) => {
                window.webContents.send('notion:oauthComplete', {
                  success: false,
                  error:
                    error instanceof Error ? error.message : 'Unknown error',
                });
              });
            });
          });

        // Open browser
        shell.openExternal(authUrl);

        return { authUrl };
      } catch (error) {
        logger.error('Failed to start Notion OAuth', { error });
        throw error;
      }
    },
  );

  // Store OAuth result (optional direct call)
  ipcMain.handle(
    'notion:storeOAuthResult',
    async (
      _event,
      result: { accessToken: string; workspace: NotionWorkspaceMetadata },
    ): Promise<void> => {
      try {
        const tokensStore = getTokensStore();
        const currentTokens = await tokensStore.read();
        await tokensStore.write({
          ...currentTokens,
          notionAccessToken: result.accessToken,
        });

        const configStore = getConfigStore();
        const currentState = await configStore.read();
        const currentOnboarding = currentState.onboardingState;
        if (currentOnboarding) {
          await configStore.write({
            ...currentState,
            onboardingState: {
              ...currentOnboarding,
              notion: {
                ...currentOnboarding.notion,
                status: 'authed',
                workspace: result.workspace,
                updatedAt: new Date().toISOString(),
              },
            },
          });
        }
        logger.info('Notion OAuth result stored');
      } catch (error) {
        logger.error('Failed to store Notion OAuth result', { error });
        throw error;
      }
    },
  );

  // Set parent page
  ipcMain.handle(
    'notion:setParentPage',
    async (_event, parentPageId: string): Promise<void> => {
      try {
        const normalizedParentId = normalizeNotionId(parentPageId);
        const configStore = getConfigStore();
        const currentState = await configStore.read();
        const currentOnboarding = currentState.onboardingState;
        if (currentOnboarding) {
          await configStore.write({
            ...currentState,
            onboardingState: {
              ...currentOnboarding,
              notion: {
                ...currentOnboarding.notion,
                parentPageId: normalizedParentId,
                status: 'parent_selected',
                updatedAt: new Date().toISOString(),
              },
            },
          });
        }
        logger.info('Notion parent page set', {
          parentPageId: normalizedParentId,
        });
      } catch (error) {
        const notionError = toNotionError(error);
        logger.error('Failed to set Notion parent page', {
          code: notionError.code,
          message: notionError.message,
        });
        throw notionError;
      }
    },
  );

  // Create resources (real Notion API)
  ipcMain.handle(
    'notion:createResources',
    async (
      _event,
      options: { parentPageId: string },
    ): Promise<{
      flowStatePageId: string;
      dailyNotesDataSourceId: string;
      tasksDataSourceId: string;
    }> => {
      try {
        const normalizedParentId = normalizeNotionId(options.parentPageId);
        const configStore = getConfigStore();
        const currentConfig = await configStore.read();
        const onboardingState = currentConfig.onboardingState;

        return await getOrCreateResources(normalizedParentId, onboardingState);
      } catch (error) {
        const notionError = toNotionError(error);
        logger.error('Failed to create Notion resources', {
          code: notionError.code,
          message: notionError.message,
        });
        throw notionError;
      }
    },
  );

  // Full sync: tasks + daily notes
  ipcMain.handle('notion:sync', async () => {
    try {
      const result = await runSync();
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('notion:syncComplete', {
          success: true,
          tasks: result.tasks,
          notes: result.notes,
        });
      });
      return result;
    } catch (error) {
      const notionError = toNotionError(error);
      logger.error('Notion sync failed', {
        code: notionError.code,
        message: notionError.message,
      });
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('notion:syncComplete', {
          success: false,
          error: notionError.message,
        });
      });
      throw notionError;
    }
  });

  // Tasks-only sync (e.g. for dedup gate). Broadcasts errors so renderer can update store.
  ipcMain.handle('notion:syncTasks', async () => {
    try {
      return await runTasksSync();
    } catch (error) {
      const notionError = toNotionError(error);
      logger.error('Notion sync tasks failed', {
        code: notionError.code,
        message: notionError.message,
      });
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('notion:syncComplete', {
          success: false,
          error: notionError.message,
        });
      });
      throw notionError;
    }
  });

  // Publish drafts to Notion (sync -> dedup -> create/update -> re-sync broadcast)
  ipcMain.handle(
    'notion:publishDrafts',
    async (_event, payload: PublishPayload) => {
      try {
        return await publishDrafts(payload);
      } catch (error) {
        const notionError = toNotionError(error);
        logger.error('Notion publish drafts failed', {
          code: notionError.code,
          message: notionError.message,
        });
        throw notionError;
      }
    },
  );

  // Confirm status property migration
  ipcMain.handle('notion:confirmStatusMigration', async (): Promise<void> => {
    try {
      const configStore = getConfigStore();
      const config = await configStore.read();

      if (!config.onboardingState) {
        throw new NotionError(
          'NOTION_VALIDATION_ERROR',
          'Onboarding state not found',
        );
      }

      await configStore.write({
        ...config,
        onboardingState: {
          ...config.onboardingState,
          onboardingCompleted: config.onboardingState.onboardingCompleted,
          notion: {
            ...config.onboardingState.notion,
            statusPropertyMigrated: true,
            statusPropertyNeedsMigration: false,
            statusPropertyHasBeenMigrated: true,
            status: 'ready',
            updatedAt: new Date().toISOString(),
          },
        },
      });

      logger.info('Status property migration confirmed');
    } catch (error) {
      const notionError = toNotionError(error);
      logger.error('Failed to confirm status migration', {
        code: notionError.code,
        message: notionError.message,
      });
      throw notionError;
    }
  });
}
