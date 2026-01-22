/**
 * Gemini integration configuration types.
 */

import type { GeminiConfig } from '@flwst/types';

/**
 * Gemini integration configuration interface.
 */
export interface GeminiIntegrationConfig extends GeminiConfig {
  // Future: additional Gemini-specific config
}

/**
 * Placeholder for Gemini API client.
 * Phase 1: Types only, no implementation.
 */
export interface GeminiClient {
  // Future: API methods will be defined here
  generateContent(prompt: string, context: string): Promise<unknown>;
}
