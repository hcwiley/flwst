/**
 * Notion integration configuration types.
 */

import type {
  NotionConfig,
  NotionDailyNoteSchema,
  NotionTaskSchema,
} from '@flwst/types';

/**
 * Notion integration configuration interface.
 */
export interface NotionIntegrationConfig extends NotionConfig {
  // Future: additional Notion-specific config
}

/**
 * Placeholder for Notion API client.
 * Phase 1: Types only, no implementation.
 */
export interface NotionClient {
  // Future: API methods will be defined here
  createDailyNote(schema: NotionDailyNoteSchema): Promise<void>;
  createTask(schema: NotionTaskSchema): Promise<void>;
  updateTask(taskId: string, updates: Partial<NotionTaskSchema>): Promise<void>;
  getTasks(): Promise<unknown[]>;
}
