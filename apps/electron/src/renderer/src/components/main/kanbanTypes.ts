/**
 * Unified Kanban display type and mappers.
 * Maps NotionTaskPage and TaskProps (ingest) to a single shape for the board.
 * Future: dedup merge happens when building combined list in MainPane.
 */

import type { NotionTaskPage, TaskProps, TaskStatus } from '@flwst/types';

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
    source: 'ingest',
  };
}
