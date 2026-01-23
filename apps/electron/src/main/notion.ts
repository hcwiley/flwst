/**
 * IPC handlers for Notion integration.
 */

import { ipcMain, shell } from 'electron';
import { getLogger } from './sentry';
import { getTokensStore } from './storage';
import { getConfigStore } from './storage';
import type { NotionWorkspaceMetadata } from '@flwst/types';
import { completeNotionOAuth } from './notionOAuth';

/**
 * Register Notion IPC handlers.
 * Should be called after storage is initialized.
 */
export function registerNotionHandlers(): void {
  const logger = getLogger();

  // Start Notion OAuth - opens browser and handles callback
  ipcMain.handle('notion:startOAuth', async (): Promise<{ authUrl: string }> => {
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
                error: error instanceof Error ? error.message : 'Unknown error',
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
  });

  /**
   * Helper to store OAuth result.
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

  // Store OAuth result (stub - will be implemented when OAuth is wired)
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
  ipcMain.handle('notion:setParentPage', async (_event, parentPageId: string): Promise<void> => {
    try {
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
              parentPageId,
              status: 'parent_selected',
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }
      logger.info('Notion parent page set', { parentPageId });
    } catch (error) {
      logger.error('Failed to set Notion parent page', { error });
      throw error;
    }
  });

  // Create resources (stub - will be implemented when Notion API is integrated)
  ipcMain.handle(
    'notion:createResources',
    async (_event, options: { parentPageId: string }): Promise<{
      flowStatePageId: string;
      dailyNotesDbId: string;
      tasksDbId: string;
    }> => {
      try {
        // Stub: In real implementation, this would call Notion API
        logger.info('Creating Notion resources', { parentPageId: options.parentPageId });
        
        // Simulate resource creation
        const flowStatePageId = 'stub-flow-state-page-id';
        const dailyNotesDbId = 'stub-daily-notes-db-id';
        const tasksDbId = 'stub-tasks-db-id';

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
                dailyNotesDbId,
                tasksDbId,
                status: 'ready',
                updatedAt: new Date().toISOString(),
              },
            },
          });
        }

        logger.info('Notion resources created', {
          flowStatePageId,
          dailyNotesDbId,
          tasksDbId,
        });

        return {
          flowStatePageId,
          dailyNotesDbId,
          tasksDbId,
        };
      } catch (error) {
        logger.error('Failed to create Notion resources', { error });
        throw error;
      }
    },
  );
}
