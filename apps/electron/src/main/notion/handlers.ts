/**
 * Notion IPC handlers registration.
 * Registers all Electron IPC handlers for Notion integration.
 */

import { ipcMain, shell } from 'electron';
import type { NotionWorkspaceMetadata } from '@flwst/types';
import { getLogger } from '../sentry';
import { getConfigStore, getTokensStore } from '../storage';
import { completeNotionOAuth } from './notionOAuth';
import { normalizeNotionId } from './notionSchema';
import { toNotionError } from './errors';
import { getOrCreateResources } from './resources';
import { NotionError } from './errors';

const logger = getLogger();

/**
 * Helper to store OAuth result in tokens and onboarding state.
 */
async function handleOAuthResult(result: {
  accessToken: string;
  workspace: NotionWorkspaceMetadata;
}): Promise<void> {
  // DEBUG: notion-onboarding
  logger.debug('notion-onboarding', {
    sessionId: 'debug-session',
    runId: 'pre',
    hypothesisId: 'H8',
    location: 'src/main/notion/handlers.ts:handleOAuthResult:entry',
    message: 'handleOAuthResult entry',
    data: {
      hasAccessToken: !!result.accessToken,
      hasWorkspaceId: !!result.workspace?.workspaceId,
    },
    timestamp: Date.now(),
  });
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
  // DEBUG: notion-onboarding
  logger.debug('notion-onboarding', {
    sessionId: 'debug-session',
    runId: 'pre',
    hypothesisId: 'H8',
    location: 'src/main/notion/handlers.ts:handleOAuthResult:stored',
    message: 'handleOAuthResult stored tokens and onboarding',
    data: {
      hadOnboardingState: !!currentOnboarding,
      statusSet: currentOnboarding ? 'authed' : 'skipped',
    },
    timestamp: Date.now(),
  });
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
