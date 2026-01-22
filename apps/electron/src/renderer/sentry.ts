/**
 * Sentry initialization for Electron renderer process.
 * Initialized as early as possible to catch all errors.
 */

import { logger, setExternalLogger } from '@flwst/core';

/**
 * Initialize Sentry for Electron renderer process.
 * Should be called as early as possible in the renderer process.
 *
 * @param dsn - Sentry DSN (optional, if not provided Sentry is disabled)
 * @param environment - Environment name (defaults to 'development')
 */
export function initSentryRenderer(
  dsn?: string,
  environment: string = 'development',
): void {
  const logsEnabled =
    environment === 'production' || process.env.SENTRY_LOGS_ENABLED === 'true';

  if (!dsn) {
    // No DSN provided - Sentry disabled
    logger.warn('Sentry DSN not configured - error tracking disabled', {
      environment,
      hint: 'Set SENTRY_DSN environment variable to enable Sentry',
    });
    return;
  }

  // Dynamic import to avoid loading Sentry in environments where it's not needed
  import('@sentry/electron/renderer')
    .then((sentry) => {
      sentry.init({
        dsn,
        environment,
        enableLogs: logsEnabled,
        // Redact sensitive data per security guide
        beforeSend(event) {
          // Remove any potential sensitive data from context
          if (event.contexts) {
            delete event.contexts.secrets;
          }
          if (event.user) {
            // Only keep non-sensitive user metadata
            event.user = {
              id: event.user.id,
            };
          }
          return event;
        },
      });

      // Forward core logs to Sentry's logger API (production or explicit opt-in)
      setExternalLogger(logsEnabled ? sentry.logger : null);

      logger.info('Sentry renderer process initialized', {
        environment,
        dsnConfigured: !!dsn,
        logsEnabled,
      });
    })
    .catch((err) => {
      logger.error('Failed to initialize Sentry renderer process', {
        error: err,
      });
    });
}

/**
 * Get the Sentry-enabled logger instance.
 * Returns the base logger if Sentry is not initialized.
 */
export function getLogger() {
  return logger;
}
