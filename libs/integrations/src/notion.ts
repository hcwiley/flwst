/**
 * Notion integration configuration types.
 */

import type {
  DedupResult,
  NotionConfig,
  NotionDailyNotePage,
  NotionDailyNoteSchema,
  NotionTaskPage,
  NotionTaskSchema,
} from '@flwst/types';

/**
 * Notion integration configuration interface.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NotionIntegrationConfig extends NotionConfig {
  // Future: additional Notion-specific config
}

/** Draft task shape for dedup gate input. */
export interface NotionDraftTask {
  name: string;
  project?: string;
  description?: string;
  priority?: string;
  status?: string;
  tags?: string[];
  due?: string;
}

/**
 * Notion API client interface.
 * Implementations: Electron main process (IPC), tests (mocks).
 */
export interface NotionClient {
  createDailyNote(schema: NotionDailyNoteSchema): Promise<void>;
  createTask(schema: NotionTaskSchema): Promise<void>;
  updateTask(taskId: string, updates: Partial<NotionTaskSchema>): Promise<void>;
  getTasks(): Promise<unknown[]>;
  /** Query Tasks database for canonical snapshot. */
  queryTasks(): Promise<NotionTaskPage[]>;
  /** Query Daily Notes database for canonical snapshot. */
  queryDailyNotes(): Promise<NotionDailyNotePage[]>;
  /** Run dedup gate: draft tasks + snapshot -> create/update/skip per draft. */
  dedupCheck(
    draftTasks: NotionDraftTask[],
    tasksById: Record<string, NotionTaskPage>,
  ): DedupResult[];
}
