/**
 * Firebase integration configuration types.
 */

import type { FirebaseConfig } from '@flwst/types';

/**
 * Firebase integration configuration interface.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FirebaseIntegrationConfig extends FirebaseConfig {
  // Future: additional Firebase-specific config
}

/**
 * Placeholder for Firebase API client.
 * Phase 1: Types only, no implementation.
 */
export interface FirebaseClient {
  // Future: API methods will be defined here
  generateDailyNote(transcript: string, prompt: string): Promise<unknown>;
  generateTasks(transcript: string, prompt: string): Promise<unknown>;
}
