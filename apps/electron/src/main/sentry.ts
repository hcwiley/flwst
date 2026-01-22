/**
 * Sentry initialization for Electron main process.
 * Initialized as early as possible to catch all errors.
 */

/**
 * Initialize Sentry for Electron main process.
 * Should be called as early as possible in the main process.
 *
 * @param dsn - Sentry DSN (optional, if not provided Sentry is disabled)
 * @param environment - Environment name (defaults to 'development')
 */
export function initSentryMain(
  dsn?: string,
  environment: string = 'development',
): void {
  if (!dsn) {
    // No DSN provided - Sentry disabled
    return;
  }

  // Dynamic import to avoid loading Sentry in environments where it's not needed
  import('@sentry/electron/main')
    .then((sentry) => {
      sentry.init({
        dsn,
        environment,
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
    })
    .catch(() => {
      // Sentry not available - silently fail
    });
}
