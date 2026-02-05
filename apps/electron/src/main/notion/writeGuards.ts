/**
 * Write safety: normalize assignee to valid Notion user ID and build safe payloads.
 * Only send people: [{ id }] when input is a valid 32-hex Notion user ID.
 */

import { getLogger } from '../sentry';

const logger = getLogger();

/**
 * Normalize input to a valid Notion user ID (32 hex chars, hyphens allowed).
 * Returns undefined if invalid; do not send invalid person payloads.
 */
export function normalizeNotionUserId(input?: string): string | undefined {
  if (input == null || typeof input !== 'string') return undefined;
  const normalized = input.trim();
  if (!normalized) return undefined;

  const hex = normalized.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) return undefined;

  return hex;
}

/**
 * Mutable props object that may receive Assignee.
 * Use for building Notion page create/update payloads.
 */
export interface NotionWriteProps {
  Assignee?: { people: { id: string }[] };
  [key: string]: unknown;
}

/**
 * Add Assignee to props only if assignee normalizes to a valid Notion user ID.
 * Log and skip invalid assignee; do not set Assignee.
 */
export function maybeAddAssignee(
  props: NotionWriteProps,
  assignee?: string,
): void {
  if (assignee === undefined) return;

  const assigneeId = normalizeNotionUserId(assignee);
  if (!assigneeId) {
    logger.debug('Skipping invalid assignee; not sending people payload', {
      assigneeLength: assignee.length,
    });
    return;
  }

  props.Assignee = { people: [{ id: assigneeId }] };
}
