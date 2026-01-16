/**
 * Status normalization helpers for kanban display and filtering.
 *
 * Keeps status comparisons case-insensitive while preserving canonical names.
 */

/**
 * Default kanban status ordering when Notion has no metadata.
 */
export const DEFAULT_KANBAN_STATUSES = [
  'TODO',
  'On Deck',
  'In Progress',
  'BLOCKED',
  'Backlog',
  'Done',
  'Cancelled',
];

/**
 * Default enabled statuses when first rendering the board.
 */
export const DEFAULT_ENABLED_KANBAN_STATUSES = ['TODO', 'On Deck', 'In Progress', 'BLOCKED'];

/**
 * Normalize status to canonical case for case-insensitive comparison.
 */
export function normalizeStatus(status: string): string {
  const normalized = status.trim();
  const lower = normalized.toLowerCase();

  // Map common variations to schema-defined values.
  const statusMap: Record<string, string> = {
    todo: 'TODO',
    'on deck': 'On Deck',
    'in progress': 'In Progress',
    blocked: 'BLOCKED',
    done: 'Done',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
  };

  return statusMap[lower] || normalized;
}

/**
 * Compare statuses with normalization applied.
 */
export function statusEquals(status1: string, status2: string): boolean {
  return normalizeStatus(status1) === normalizeStatus(status2);
}

/**
 * Toggle a normalized status in a list while preserving stored labels.
 */
export function toggleStatusList(current: string[], status: string): string[] {
  const normalizedStatus = normalizeStatus(status);
  const normalizedCurrent = current.map(normalizeStatus);
  if (normalizedCurrent.includes(normalizedStatus)) {
    return current.filter((value) => !statusEquals(value, normalizedStatus));
  }
  return [...current, normalizedStatus];
}
