/**
 * IPC handlers for onboarding flow.
 */

import { ipcMain } from 'electron';
import { getLogger } from './sentry';
import { getConfigStore } from './storage';
import type { OnboardingState } from '@flwst/types';
import { getDefaultOnboardingState } from '@flwst/types';

/**
 * Register onboarding IPC handlers.
 * Should be called after storage is initialized.
 */
export function registerOnboardingHandlers(): void {
  const logger = getLogger();

  // Get onboarding state
  ipcMain.handle('onboarding:getState', async (): Promise<OnboardingState> => {
    try {
      const configStore = getConfigStore();
      const state = await configStore.read();
      const onboardingState = state.onboardingState;
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H10',
        location: 'src/main/onboarding.ts:getState',
        message: 'onboarding state read',
        data: {
          hasOnboardingState: !!onboardingState,
          notionStatus: onboardingState?.notion?.status,
          hasParentPageId: !!onboardingState?.notion?.parentPageId,
          hasWorkspaceId: !!onboardingState?.notion?.workspace?.workspaceId,
          onboardingCompleted: !!onboardingState?.onboardingCompleted,
        },
        timestamp: Date.now(),
      });
      if (onboardingState) {
        return onboardingState;
      }
      return getDefaultOnboardingState();
    } catch (error) {
      logger.error('Failed to get onboarding state', { error });
      return getDefaultOnboardingState();
    }
  });

  // Update onboarding state
  ipcMain.handle(
    'onboarding:updateState',
    async (_event, partial: Partial<OnboardingState>): Promise<void> => {
      try {
        const configStore = getConfigStore();
        const currentState = await configStore.read();
        const currentOnboarding =
          currentState.onboardingState || getDefaultOnboardingState();
        const updatedOnboarding: OnboardingState = {
          ...currentOnboarding,
          ...partial,
          updatedAt: new Date().toISOString(),
        };
        const updatedConfig = {
          ...currentState,
          onboardingState: updatedOnboarding,
        };
        await configStore.write(updatedConfig);
        // DEBUG: notion-onboarding
        logger.debug('notion-onboarding', {
          sessionId: 'debug-session',
          runId: 'pre',
          hypothesisId: 'H10',
          location: 'src/main/onboarding.ts:updateState',
          message: 'onboarding state persisted',
          data: {
            notionStatus: updatedOnboarding?.notion?.status,
            hasParentPageId: !!updatedOnboarding?.notion?.parentPageId,
            hasWorkspaceId: !!updatedOnboarding?.notion?.workspace?.workspaceId,
            onboardingCompleted: !!updatedOnboarding?.onboardingCompleted,
          },
          timestamp: Date.now(),
        });
        logger.info('Onboarding state updated');
      } catch (error) {
        logger.error('Failed to update onboarding state', { error });
        throw error;
      }
    },
  );
}
