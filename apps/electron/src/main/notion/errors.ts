/**
 * Notion error types and error mapping utilities.
 * Centralizes error handling for Notion API interactions.
 */

import { APIErrorCode, APIResponseError } from '@notionhq/client';

export type NotionErrorCode =
  | 'NOTION_TOKEN_MISSING'
  | 'NOTION_PERMISSION_DENIED'
  | 'NOTION_PARENT_NOT_FOUND'
  | 'NOTION_RATE_LIMITED'
  | 'NOTION_VALIDATION_ERROR'
  | 'NOTION_NOT_SHARED_WITH_PARENT';

export class NotionError extends Error {
  public readonly code: NotionErrorCode;

  constructor(code: NotionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Convert unknown errors to NotionError.
 * Maps APIResponseError codes to NotionErrorCode.
 */
export function toNotionError(error: unknown): NotionError {
  if (error instanceof NotionError) {
    return error;
  }
  if (error instanceof APIResponseError) {
    const code = mapApiErrorCode(error);
    return new NotionError(code, error.message);
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new NotionError('NOTION_VALIDATION_ERROR', message);
}

/**
 * Map Notion API error codes to NotionErrorCode.
 */
export function mapApiErrorCode(error: APIResponseError): NotionErrorCode {
  if (error.code === APIErrorCode.Unauthorized) {
    return 'NOTION_TOKEN_MISSING';
  }
  if (error.code === APIErrorCode.RestrictedResource) {
    if (isNotionNotShared(error.message)) {
      return 'NOTION_NOT_SHARED_WITH_PARENT';
    }
    return 'NOTION_PERMISSION_DENIED';
  }
  if (error.code === APIErrorCode.ObjectNotFound) {
    return 'NOTION_PARENT_NOT_FOUND';
  }
  if (error.code === APIErrorCode.RateLimited) {
    return 'NOTION_RATE_LIMITED';
  }
  if (error.code === APIErrorCode.ValidationError) {
    return 'NOTION_VALIDATION_ERROR';
  }
  return 'NOTION_VALIDATION_ERROR';
}

/**
 * Check if error message indicates resource is not shared with parent.
 */
export function isNotionNotShared(message: string): boolean {
  return (
    message.toLowerCase().includes('not shared') ||
    message.toLowerCase().includes('not accessible')
  );
}
