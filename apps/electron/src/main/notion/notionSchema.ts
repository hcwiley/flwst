/**
 * Notion schema helpers for database creation.
 *
 * These helpers are pure and intentionally small so they can be unit tested.
 * They define the Notion database property schema (design-time), which is
 * separate from the runtime mapping of artifacts into Notion page properties.
 */

import { PrioritySchema, TaskStatusSchema } from '@flwst/types';
import { getLogger } from '../sentry';
import type { NotionDatabaseProperties } from './notionTypes';

const logger = getLogger();
const NOTION_ID_REGEX = /^[0-9a-f]{32}$/i;
const NOTION_HEX_REGEX = /[0-9a-f]{32}/gi;
const NOTION_UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function extractNotionIdCandidate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const fromUrl = parseNotionUrlCandidate(trimmed);
  if (fromUrl) {
    return fromUrl;
  }

  const fromUuid = findLastMatch(trimmed, NOTION_UUID_REGEX);
  if (fromUuid) {
    return fromUuid;
  }

  const fromHex = findLastMatch(trimmed, NOTION_HEX_REGEX);
  if (fromHex) {
    return fromHex;
  }

  return null;
}

function parseNotionUrlCandidate(input: string): string | null {
  if (!input.startsWith('http://') && !input.startsWith('https://')) {
    return null;
  }

  try {
    const url = new URL(input);
    const segment = url.pathname.split('/').filter(Boolean).pop() ?? '';
    const fromSegment =
      findLastMatch(segment, NOTION_UUID_REGEX) ??
      findLastMatch(segment, NOTION_HEX_REGEX);
    if (fromSegment) {
      return fromSegment;
    }
    return null;
  } catch {
    return null;
  }
}

function findLastMatch(value: string, regex: RegExp): string | null {
  const matches = Array.from(value.matchAll(regex));
  if (matches.length === 0) {
    return null;
  }
  return matches[matches.length - 1][0];
}

/**
 * Normalize a Notion ID into canonical UUID-ish format.
 * Notion accepts both hyphenated and non-hyphenated IDs.
 */
export function normalizeNotionId(id: string): string {
  const candidate = extractNotionIdCandidate(id);
  if (!candidate) {
    throw new Error(`Invalid Notion ID format: ${id}`);
  }

  const raw = candidate.replace(/-/g, '').toLowerCase();
  if (!NOTION_ID_REGEX.test(raw)) {
    throw new Error(`Invalid Notion ID format: ${id}`);
  }
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

/**
 * Build Task database properties (design-time schema).
 */
export function buildTasksDbProperties(
  dailyNotesDataSourceId?: string,
): NotionDatabaseProperties {
  const priorityColorMap: Record<string, string> = {
    low: 'gray',
    medium: 'blue',
    high: 'orange',
    urgent: 'red',
  };

  const priorityOptions = PrioritySchema.options.map((priority) => ({
    name: priority,
    color: priorityColorMap[priority] || 'default',
  }));

  // Status options with colors that map to workflow stages
  // Users should convert this to a Status property in Notion UI for better workflow features
  const statusOptions = TaskStatusSchema.options.map((status) => {
    // Map status values to appropriate colors
    const colorMap: Record<string, string> = {
      Backlog: 'gray',
      'To-do': 'default',
      'On Deck': 'blue',
      'In progress': 'yellow',
      BLOCKED: 'red',
      Done: 'green',
      Cancelled: 'gray',
    };
    return {
      name: status,
      color: colorMap[status] || 'default',
    };
  });

  const properties: NotionDatabaseProperties = {
    Name: { title: {} },
    Project: { select: { options: [] } },
    Description: { rich_text: {} },
    Priority: { select: { options: priorityOptions } },
    Status: { select: { options: statusOptions } },
    Tags: { multi_select: { options: [] } },
    'Due Date': { date: {} },
    Assignee: { rich_text: {} },
    'Source Run ID': { rich_text: {} },
  };

  if (dailyNotesDataSourceId) {
    properties['Daily Notes'] = {
      relation: {
        data_source_id: dailyNotesDataSourceId,
        type: 'single_property',
        single_property: {},
      },
    };
  }

  return properties;
}

/**
 * Build Daily Notes database properties (design-time schema).
 */
export function buildDailyNotesDbProperties(
  tasksDataSourceId?: string,
): NotionDatabaseProperties {
  const properties: NotionDatabaseProperties = {
    Name: { title: {} },
    Date: { date: {} },
    Summary: { rich_text: {} },
    Tags: { multi_select: { options: [] } },
  };

  if (tasksDataSourceId) {
    properties.Tasks = {
      relation: {
        data_source_id: tasksDataSourceId,
        type: 'single_property',
        single_property: {},
      },
    };
  }

  return properties;
}
