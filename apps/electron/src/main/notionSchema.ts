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
    Status: { status: {} },
    Tags: { multi_select: { options: [] } },
    'Due Date': { date: {} },
    Assignee: { rich_text: {} },
    'Source Run ID': { rich_text: {} },
  };

  if (dailyNotesRelationDatabaseId) {
    properties['Daily Notes'] = {
      relation: {
        database_id: normalizeNotionId(dailyNotesRelationDatabaseId),
        type: 'single_property',
        single_property: {},
      },
    };
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H3',
      location: 'src/main/notionSchema.ts:buildTasksDbProperties',
      message: 'built tasks db properties',
      data: {
        keyCount: Object.keys(properties).length,
        hasRelation: !!dailyNotesRelationDatabaseId,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

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
        type: 'single_property',
        single_property: {},
      },
    };
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H3',
      location: 'src/main/notionSchema.ts:buildDailyNotesDbProperties',
      message: 'built daily notes db properties',
      data: {
        keyCount: Object.keys(properties).length,
        hasRelation: !!tasksRelationDatabaseId,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  return properties;
}
