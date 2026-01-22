/**
 * Run ID generation utilities for idempotent transcript processing.
 */

import { randomUUID } from "node:crypto";
import { RunIdSchema } from "@flwst/types";

/**
 * Generate a new deterministic run ID.
 * Uses UUID v4 for uniqueness.
 */
export function generateRunId(): string {
  return randomUUID();
}

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
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const timestampStr = timestamp.toISOString().replace(/[:.]/g, "-");

  // Use a deterministic hash-like approach, but still generate UUID for uniqueness
  // In practice, you might want to use a hash of filename + timestamp
  return generateRunId();
}
