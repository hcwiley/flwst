/**
 * Simple logging utility for FlowState pipeline.
 */

import type { LogEntry } from '@flwst/types';

/**
 * Log levels.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface for structured logging.
 */
export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
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
      externalLogger?.[level]?.(message, metadata);
    } catch {
      // Ignore failures in external logger sinks.
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }
}

/**
 * Create a logger instance.
 */
export function createLogger(minLevel: LogLevel = 'info'): Logger {
  return new ConsoleLogger(minLevel);
}

/**
 * Default logger instance.
 */
export const logger = createLogger();
