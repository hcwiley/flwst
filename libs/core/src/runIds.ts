/**
 * Run ID generation utilities for idempotent transcript processing.
 */

import { RunIdSchema, type RunId } from '@flwst/types';
import crypto from 'node:crypto';

/**
 * Validate a run ID format.
 */
export function validateRunId(id: string): boolean {
  return RunIdSchema.safeParse(id).success;
}

/**
 * Convert a 32-char md5 hex string into an RFC4122 v4 UUID.
 * Deterministic mapping used for idempotent run IDs.
 */
export function md5HashToUuidV4(hash: string): RunId {
  const normalized = hash.toLowerCase();

  if (!/^[a-f0-9]{32}$/.test(normalized)) {
    throw new Error('md5 hash must be a 32-char hex string');
  }

  const bytes = Array.from({ length: 16 }, (_, index) =>
    Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16),
  );

  // Set UUID version and variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;

  return uuid as RunId;
}

/**
 * Create a run ID from a filename and timestamp.
 * This is deterministic for idempotent processing.
 */
export function createRunIdFromFilename(
  filename: string,
  timestamp: Date = new Date(),
): RunId {
  const normalized = filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-');

  // Use the filename-timestamp hashed into md5, formatted as a UUID.
  const hash = crypto
    .createHash('md5')
    .update(`${normalized}-${timestampStr}`)
    .digest('hex');
  return md5HashToUuidV4(hash);
}
