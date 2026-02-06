/**
 * Unified Kanban display type and mappers.
 * Maps NotionTaskPage and TaskProps (ingest) to a single shape for the board.
 * Display-level dedup (ingest vs Notion by title) is applied in MainPane when building the combined list.
 */

import type {
  KanbanSortDir,
  KanbanSortKey,
  NotionTaskPage,
  TaskProps,
  TaskStatus,
} from '@flwst/types';

export type TaskSource = 'notion' | 'ingest';

/** Unified fields for Kanban display; status/priority normalized for column grouping. */
export type KanbanTaskDisplay = {
  /** Notion page id when source === 'notion'; used as stable React key. */
  id?: string;
  /** Notion page URL when source === 'notion'; future: open via shell.openExternal. */
  url?: string;
  name: string;
  status: TaskStatus;
  priority: string;
  project?: string;
  description?: string;
  tags: string[];
  due?: string;
  /** ISO timestamp for sorting ("Last Updated" in Notion). */
  updatedAt: string;
  source: TaskSource;
};

/** Shared status normalization so Notion and ingest tasks land in the same columns. */
export const STATUS_MAP: Record<string, TaskStatus> = {
  Backlog: 'Backlog',
  'To-do': 'To-do',
  TODO: 'To-do',
  'To Do': 'To-do',
  'On Deck': 'On Deck',
  'In progress': 'In progress',
  'In Progress': 'In progress',
  BLOCKED: 'BLOCKED',
  Blocked: 'BLOCKED',
  Done: 'Done',
  Cancelled: 'Cancelled',
  Canceled: 'Cancelled',
};

const DEFAULT_STATUS: TaskStatus = 'Backlog';

/** Map a Notion task to the unified Kanban display type. */
export function notionTaskToDisplay(task: NotionTaskPage): KanbanTaskDisplay {
  return {
    id: task.id,
    url: task.url,
    name: task.title,
    status: task.status,
    priority: task.priority,
    project: task.project,
    description: task.description,
    tags: task.tags ?? [],
    due: task.dueDate,
    updatedAt: task.updatedAt,
    source: 'notion',
  };
}

/** Map an ingest (LLM) task to the unified Kanban display type; normalizes status. */
export function ingestTaskToDisplay(task: TaskProps): KanbanTaskDisplay {
  return {
    name: task.name,
    status: STATUS_MAP[task.status] ?? DEFAULT_STATUS,
    priority: task.priority,
    project: task.project,
    description: task.description,
    tags: task.tags ?? [],
    due: task.due,
    updatedAt: new Date(0).toISOString(),
    source: 'ingest',
  };
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareDates(a: string, b: string): number {
  const left = Number.isNaN(Date.parse(a)) ? 0 : Date.parse(a);
  const right = Number.isNaN(Date.parse(b)) ? 0 : Date.parse(b);
  return left - right;
}

function comparePriority(a: string, b: string): number {
  const left = PRIORITY_RANK[a.trim().toLowerCase()] ?? 0;
  const right = PRIORITY_RANK[b.trim().toLowerCase()] ?? 0;
  return left - right;
}

function compareProject(a?: string, b?: string): number {
  const left = (a ?? '').trim();
  const right = (b ?? '').trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return compareStrings(left, right);
}

/**
 * Sort tasks for a column with deterministic ordering.
 */
export function sortTasks(
  tasks: KanbanTaskDisplay[],
  sortKey: KanbanSortKey,
  sortDir: KanbanSortDir,
): KanbanTaskDisplay[] {
  const direction = sortDir === 'asc' ? 1 : -1;
  return [...tasks].sort((left, right) => {
    let comparison = 0;
    if (sortKey === 'name') {
      comparison = compareStrings(left.name, right.name);
    } else if (sortKey === 'updatedAt') {
      comparison = compareDates(left.updatedAt, right.updatedAt);
    } else if (sortKey === 'priority') {
      comparison = comparePriority(left.priority, right.priority);
    } else if (sortKey === 'project') {
      comparison = compareProject(left.project, right.project);
    }
    return comparison * direction;
  });
}
