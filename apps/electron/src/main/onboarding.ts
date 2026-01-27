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
        logger.info('Onboarding state updated');
      } catch (error) {
        logger.error('Failed to update onboarding state', { error });
        throw error;
      }
    },
  );
}
