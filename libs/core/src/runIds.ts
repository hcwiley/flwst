/**
 * Run ID generation utilities for idempotent transcript processing.
 */

import { RunIdSchema } from '@flwst/types';
import crypto from 'node:crypto';

/**
 * Validate a run ID format.
 */
export function validateRunId(id: string): boolean {
  return RunIdSchema.safeParse(id).success;
}

/**
 * Create a run ID from a filename and timestamp.
 * This is deterministic for idempotent processing.
 */
export function createRunIdFromFilename(
  filename: string,
  timestamp: Date = new Date(),
): string {
  const normalized = filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-');

  // use the filename-timestamp hashed into md5
  const hash = crypto
    .createHash('md5')
    .update(`${normalized}-${timestampStr}`)
    .digest('hex');
  return hash;
}
