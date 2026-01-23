/**
 * Notion schema helpers for database creation.
 *
 * These helpers are pure and intentionally small so they can be unit tested.
 * They define the Notion database property schema (design-time), which is
 * separate from the runtime mapping of artifacts into Notion page properties.
 */

import type { CreateDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { PrioritySchema, TaskStatusSchema } from '@flwst/types';

type NotionDatabaseProperties = CreateDatabaseParameters['properties'];

const NOTION_ID_REGEX = /^[0-9a-f]{32}$/i;

/**
 * Normalize a Notion ID into canonical UUID-ish format.
 * Notion accepts both hyphenated and non-hyphenated IDs.
 */
export function normalizeNotionId(id: string): string {
  const raw = id.replace(/-/g, '').toLowerCase();
  if (!NOTION_ID_REGEX.test(raw)) {
    throw new Error(`Invalid Notion ID format: ${id}`);
  }
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

/**
 * Build Task database properties (design-time schema).
 */
export function buildTasksDbProperties(
  dailyNotesRelationDatabaseId?: string,
): NotionDatabaseProperties {
  const priorityOptions = PrioritySchema.options.map((priority) => ({
    name: priority,
  }));
  const statusOptions = TaskStatusSchema.options.map((status) => ({
    name: status,
  }));

  const properties: NotionDatabaseProperties = {
    Name: { title: {} },
    Project: { select: { options: [] } },
    Description: { rich_text: {} },
    Priority: { select: { options: priorityOptions } },
    Status: { status: { options: statusOptions } },
    Tags: { multi_select: { options: [] } },
    'Due Date': { date: {} },
    Assignee: { rich_text: {} },
    'Source Run ID': { rich_text: {} },
  };

  if (dailyNotesRelationDatabaseId) {
    properties['Daily Notes'] = {
      relation: {
        database_id: normalizeNotionId(dailyNotesRelationDatabaseId),
      },
    };
  }

  return properties;
}

/**
 * Build Daily Notes database properties (design-time schema).
 */
export function buildDailyNotesDbProperties(
  tasksRelationDatabaseId?: string,
): NotionDatabaseProperties {
  const properties: NotionDatabaseProperties = {
    Name: { title: {} },
    Date: { date: {} },
    Summary: { rich_text: {} },
    Tags: { multi_select: { options: [] } },
  };

  if (tasksRelationDatabaseId) {
    properties.Tasks = {
      relation: {
        database_id: normalizeNotionId(tasksRelationDatabaseId),
      },
    };
  }

  return properties;
}
