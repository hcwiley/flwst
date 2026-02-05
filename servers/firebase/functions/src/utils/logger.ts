/**
 * Structured server-side logging for FlowState API.
 * Logs metadata only (no raw transcript, prompt, or model output).
 */

import * as logger from 'firebase-functions/logger';

/**
 * Metadata logged when a generate request is received.
 */
export interface RequestLogData {
  runId: string;
  timestamp: string;
  appVersion?: string;
  transcriptLength: number;
  promptLengths: { dailyNote: number; taskDraft: number };
}

/**
 * Metadata logged when a generate response is sent.
 */
export interface ResponseLogData {
  runId: string;
  success: boolean;
  durationMs: number;
  model: string;
  tokenUsage?: { prompt: number; completion: number };
  errorCode?: string;
}

/**
 * Log incoming generate request metadata (no content).
 */
export function logRequest(data: RequestLogData): void {
  logger.info('api:generate:request', { ...data, structuredData: true });
}

/**
 * Log generate response metadata (no content).
 */
export function logResponse(data: ResponseLogData): void {
  logger.info('api:generate:response', { ...data, structuredData: true });
}
