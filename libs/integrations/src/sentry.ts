/**
 * Sentry integration for error tracking and crash reporting.
 * Handles initialization for both Electron main and renderer processes.
 */

import type { SentryConfig } from '@flwst/types';

/**
 * Sentry integration configuration interface.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SentryIntegrationConfig extends SentryConfig {
  // Future: additional Sentry-specific config
}

/**
 * Initialize Sentry for Electron main process.
 * Should be called as early as possible in the main process.
 *
 * @param config - Sentry configuration with DSN and environment
 */
export function initSentryMain(config: SentryIntegrationConfig): void {
  if (!config.dsn) {
    // No DSN provided - Sentry disabled
    return;
  }

  const dsn = config.dsn; // TypeScript now knows this is defined

  // Dynamic import to avoid loading Sentry in environments where it's not needed
  // @ts-expect-error - @sentry/electron is a peer dependency, only available in Electron apps
  import('@sentry/electron/main')
    .then(
      (sentry: {
        init: (options: {
          dsn: string;
          environment: string;
          beforeSend?: (event: unknown) => unknown | null;
        }) => void;
      }) => {
        sentry.init({
          dsn,
          environment: config.environment || 'development',
          // Redact sensitive data per security guide
          beforeSend(event: unknown) {
            const e = event as {
              contexts?: Record<string, unknown>;
              user?: { id?: string };
            };
            // Remove any potential sensitive data from context
            if (e.contexts) {
              delete e.contexts.secrets;
            }
            if (e.user) {
              // Only keep non-sensitive user metadata
              e.user = {
                id: e.user.id,
              };
            }
            return event;
          },
        });
      },
    )
    .catch(() => {
      // Sentry not available - silently fail
    });
}

/**
 * Initialize Sentry for Electron renderer process.
 * Should be called as early as possible in the renderer process.
 *
 * @param config - Sentry configuration with DSN and environment
 */
export function initSentryRenderer(config: SentryIntegrationConfig): void {
  if (!config.dsn) {
    // No DSN provided - Sentry disabled
    return;
  }

  const dsn = config.dsn; // TypeScript now knows this is defined

  // Dynamic import to avoid loading Sentry in environments where it's not needed
  // @ts-expect-error - @sentry/electron is a peer dependency, only available in Electron apps
  import('@sentry/electron/renderer')
    .then(
      (sentry: {
        init: (options: {
          dsn: string;
          environment: string;
          beforeSend?: (event: unknown) => unknown | null;
        }) => void;
      }) => {
        sentry.init({
          dsn,
          environment: config.environment || 'development',
          // Redact sensitive data per security guide
          beforeSend(event: unknown) {
            const e = event as {
              contexts?: Record<string, unknown>;
              user?: { id?: string };
            };
            // Remove any potential sensitive data from context
            if (e.contexts) {
              delete e.contexts.secrets;
            }
            if (e.user) {
              // Only keep non-sensitive user metadata
              e.user = {
                id: e.user.id,
              };
            }
            return event;
          },
        });
      },
    )
    .catch(() => {
      // Sentry not available - silently fail
    });
}
