/**
 * Sentry initialization for Electron renderer process.
 * Initialized as early as possible to catch all errors.
 */

import { logger, setExternalLogger } from '@flwst/core';
import type { ExternalLogger, Logger } from '@flwst/core';

type SentryRendererModule = typeof import('@sentry/electron/renderer');
type SentrySeverity = 'debug' | 'info' | 'warning' | 'error';

/**
 * Build an external logger that forwards logs to Sentry.
 */
function createSentryExternalLogger(
  sentry: SentryRendererModule,
): ExternalLogger {
  const capture = (
    level: SentrySeverity,
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void => {
    sentry.withScope((scope) => {
      scope.setLevel(level);

      // Handle message as object or string
      const messageStr =
        typeof message === 'string'
          ? message
          : JSON.stringify(message, null, 2);

      if (metadata) {
        scope.setExtras(metadata);
      }

      const error = metadata?.error;
      if (error instanceof Error) {
        scope.setContext('log', { message: messageStr });
        sentry.captureException(error);
        return;
      }

      sentry.captureMessage(messageStr);
    });
  };

  return {
    debug: (message, metadata) => capture('debug', message, metadata),
    info: (message, metadata) => capture('info', message, metadata),
    warn: (message, metadata) => capture('warning', message, metadata),
    error: (message, metadata) => capture('error', message, metadata),
  };
}

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

      // Forward core logs into Sentry (production or explicit opt-in)
      const externalLogger = logsEnabled
        ? createSentryExternalLogger(sentry)
        : null;
      setExternalLogger(externalLogger);

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
export function getLogger(): Logger {
  return logger;
}
