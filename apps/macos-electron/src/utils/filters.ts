/**
 * Kanban filter helpers for the renderer.
 *
 * Provides consistent defaults for kanban refresh inputs.
 */
import type { KanbanFilters } from '../types/ui';

/**
 * Build the default filter state (last 14 days).
 */
export function createDefaultKanbanFilters(): KanbanFilters {
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() - 14);

  return {
    project: '',
    status: '',
    dueStart: '',
    dueEnd: '',
    createdAfter: defaultDate.toISOString().slice(0, 10),
  };
}
