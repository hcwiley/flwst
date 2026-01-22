/**
 * Sentry integration configuration types.
 */

import type { SentryConfig } from "@flwst/types";

/**
 * Sentry integration configuration interface.
 */
export interface SentryIntegrationConfig extends SentryConfig {
  // Future: additional Sentry-specific config
}

/**
 * Placeholder for Sentry client initialization.
 * Phase 1: Types only, no implementation.
 */
export function initSentry(config: SentryIntegrationConfig): void {
  // Future: Sentry initialization will be implemented here
  // eslint-disable-next-line no-console
  console.log("Sentry initialization placeholder", config);
}
