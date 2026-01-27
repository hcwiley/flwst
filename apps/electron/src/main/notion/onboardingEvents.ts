/**
 * Onboarding state change event emitter.
 * Notifies renderer windows when onboarding state changes.
 */

import { BrowserWindow } from 'electron';
import { getLogger } from '../sentry';

const logger = getLogger();

/**
 * Emit onboarding state changed event to all renderer windows.
 * Called after main process updates onboarding state (e.g., migration flags).
 */
export function emitOnboardingStateChanged(): void {
  try {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('onboarding:stateChanged');
    });
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H13',
      location: 'src/main/notion/onboardingEvents.ts:emitOnboardingStateChanged',
      message: 'emitted onboarding state changed event',
      data: {
        windowCount: BrowserWindow.getAllWindows().length,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to emit onboarding state changed event', { error });
  }
}
