/**
 * Simple logging utility for FlowState pipeline.
 * Metadata sent to external loggers (e.g. Sentry) is redacted for telemetry safety.
 */

import type { LogEntry } from '@flwst/types';

import { redactForTelemetry } from './redact';

/**
 * Log levels.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface for structured logging.
 */
export interface Logger {
  debug(
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void;
  info(
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void;
  warn(
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void;
  error(
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void;
}

/**
 * Optional external log sink (e.g., Sentry logger).
 */
export type ExternalLogger = Pick<Logger, LogLevel>;

let externalLogger: ExternalLogger | null = null;

/**
 * Register an external logger sink to mirror log messages.
 */
export function setExternalLogger(logger: ExternalLogger | null): void {
  externalLogger = logger;
}

/**
 * Simple console logger implementation.
 */
export class ConsoleLogger implements Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
    };

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    const logFn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.log;

    if (metadata) {
      logFn(prefix, message, metadata);
    } else {
      logFn(prefix, message);
    }

    try {
      const safeMetadata = redactForTelemetry(metadata);
      externalLogger?.[level]?.(message, safeMetadata);
    } catch {
      // Ignore failures in external logger sinks.
    }
  }

  debug(
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.log('debug', msg, metadata);
  }

  info(
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.log('info', msg, metadata);
  }

  warn(
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.log('warn', msg, metadata);
  }

  error(
    message: string | Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    this.log('error', msg, metadata);
  }
}

/**
 * Create a logger instance.
 */
export function createLogger(minLevel: LogLevel = 'info'): Logger {
  return new ConsoleLogger(minLevel);
}

/**
 * Get initial log level from environment.
 */
function getInitialLogLevel(): LogLevel {
  const envLevel =
    typeof process !== 'undefined' ? process.env.LOG_LEVEL : undefined;
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  // eslint-disable-next-line no-console
  console.log(`LOG_LEVEL: ${envLevel}`);
  if (envLevel && validLevels.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  return 'info';
}

/**
 * Default logger instance.
 */
export const logger = createLogger(getInitialLogLevel());
