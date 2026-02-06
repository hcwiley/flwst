/**
 * Bidirectional normalization for Notion/LLM status and priority values.
 * Maps drift (e.g. "todo" vs "TODO", "in progress" vs "In Progress") to
 * canonical TaskStatusSchema / PrioritySchema values.
 */

import type { Priority, TaskStatus } from '@flwst/types';

/** Canonical status values from TaskStatusSchema. */
const STATUS_ALIASES: Record<string, TaskStatus> = {
  backlog: 'Backlog',
  'to-do': 'To-do',
  todo: 'To-do',
  'on deck': 'On Deck',
  'in progress': 'In progress',
  inprogress: 'In progress',
  blocked: 'BLOCKED',
  done: 'Done',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
};

/** Canonical priority values from PrioritySchema. */
const PRIORITY_ALIASES: Record<string, Priority> = {
  top: 'urgent',
  urgent: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
  'back burner': 'low',
  backburner: 'low',
};

/**
 * Normalize a raw status string to canonical TaskStatus, or undefined if unknown.
 */
export function normalizeStatus(raw?: string): TaskStatus | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const key = raw.trim().toLowerCase();
  if (!key) return undefined;
  return STATUS_ALIASES[key];
}

/**
 * Normalize a raw priority string to canonical Priority, or undefined if unknown.
 */
export function normalizePriority(raw?: string): Priority | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const key = raw.trim().toLowerCase();
  if (!key) return undefined;
  return PRIORITY_ALIASES[key];
}
