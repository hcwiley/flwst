/**
 * Notion sync service: fetch Tasks and Daily Notes via dataSources.query (SDK v5)
 * and transform to canonical NotionTaskPage / NotionDailyNotePage.
 */

import { Client } from '@notionhq/client';
import type { NotionDailyNotePage, NotionTaskPage } from '@flwst/types';
import { getLogger } from '../sentry';
import { getTokensStore } from '../storage';
import { getDataSourcesClient } from './dataSources';
import { normalizeNotionId } from './notionSchema';
import { normalizePriority, normalizeStatus } from './normalize';
import { NotionError } from './errors';

const logger = getLogger();

/** Raw page from Notion API (partial; we only read known fields). */
type RawPage = {
  id: string;
  url?: string | null;
  last_edited_time?: string;
  parent?: {
    type?: string;
    database_id?: string;
    data_source_id?: string;
  };
  properties?: Record<
    string,
    {
      type?: string;
      title?: { plain_text?: string }[];
      rich_text?: { plain_text?: string }[];
      select?: { name?: string | null };
      status?: { name?: string | null };
      date?: { start?: string | null };
      relation?: { id?: string }[];
      multi_select?: { name?: string }[];
    }
  >;
};

/**
 * Extract plain title from a page's Name/title property.
 */
function extractTitle(properties: RawPage['properties']): string {
  const name = properties?.Name;
  if (name?.type === 'title' && Array.isArray(name.title) && name.title[0]) {
    return (name.title[0].plain_text ?? '').trim();
  }
  return '';
}

/**
 * Extract first rich text content.
 */
function extractRichText(
  properties: RawPage['properties'],
  key: string,
): string {
  const prop = properties?.[key];
  if (
    prop?.type === 'rich_text' &&
    Array.isArray(prop.rich_text) &&
    prop.rich_text[0]
  ) {
    return (prop.rich_text[0].plain_text ?? '').trim();
  }
  return '';
}

/**
 * Extract select property name.
 */
function extractSelect(
  properties: RawPage['properties'],
  key: string,
): string | undefined {
  const prop = properties?.[key];
  if (prop?.type === 'select' && prop.select?.name) {
    return prop.select.name.trim();
  }
  return undefined;
}

/**
 * Extract status property name (Status property type or legacy Select).
 */
function extractStatus(
  properties: RawPage['properties'],
  key: string,
): string | undefined {
  const prop = properties?.[key];
  if (prop?.type === 'status' && prop.status?.name) {
    return prop.status.name.trim();
  }
  return extractSelect(properties, key);
}

/**
 * Extract date start string.
 */
function extractDateStart(
  properties: RawPage['properties'],
  key: string,
): string | undefined {
  const prop = properties?.[key];
  if (prop?.type === 'date' && prop.date?.start) {
    return prop.date.start.trim();
  }
  return undefined;
}

/**
 * Extract relation IDs.
 */
function extractRelationIds(
  properties: RawPage['properties'],
  key: string,
): string[] {
  const prop = properties?.[key];
  if (prop?.type !== 'relation' || !Array.isArray(prop.relation)) {
    return [];
  }
  return prop.relation.map((r) => r.id).filter(Boolean) as string[];
}

/**
 * Extract multi_select names.
 */
function extractMultiSelectNames(
  properties: RawPage['properties'],
  key: string,
): string[] {
  const prop = properties?.[key];
  if (prop?.type !== 'multi_select' || !Array.isArray(prop.multi_select)) {
    return [];
  }
  return prop.multi_select.map((m) => m.name ?? '').filter(Boolean);
}

/**
 * Ensure value is a valid ISO datetime string for updatedAt.
 */
function toIsoDatetime(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * Build page URL from base and page id (Notion format).
 */
function pageUrl(id: string): string {
  const normalized = id.replace(/-/g, '');
  return `https://www.notion.so/${normalized}`;
}

/**
 * Transform a raw Notion page from the Tasks data source into NotionTaskPage.
 * Results are already scoped by data source query; we map every page.
 */
function mapToTaskPage(raw: RawPage): NotionTaskPage {
  const title = extractTitle(raw.properties);
  const statusRaw = extractStatus(raw.properties, 'Status') ?? 'To-do';
  const status = normalizeStatus(statusRaw) ?? 'To-do';
  const priorityRaw = extractSelect(raw.properties, 'Priority') ?? 'medium';
  const priority = normalizePriority(priorityRaw) ?? 'medium';
  const updatedAt = toIsoDatetime(raw.last_edited_time);

  return {
    id: raw.id,
    url: raw.url ?? pageUrl(raw.id),
    title,
    description: extractRichText(raw.properties, 'Description') || undefined,
    priority,
    status,
    project: extractSelect(raw.properties, 'Project') ?? undefined,
    tags:
      extractMultiSelectNames(raw.properties, 'Tags').filter(Boolean) ||
      undefined,
    dueDate: extractDateStart(raw.properties, 'Due Date') ?? undefined,
    assignee: extractRichText(raw.properties, 'Assignee') || undefined,
    dailyNotes: extractRelationIds(raw.properties, 'Daily Notes'),
    updatedAt,
  };
}

/**
 * Transform a raw Notion page from the Daily Notes data source into NotionDailyNotePage.
 * Results are already scoped by data source query; we map every page.
 */
function mapToDailyNotePage(raw: RawPage): NotionDailyNotePage {
  const title = extractTitle(raw.properties);
  const date = extractDateStart(raw.properties, 'Date') ?? '';
  const updatedAt = toIsoDatetime(raw.last_edited_time);

  return {
    id: raw.id,
    url: raw.url ?? pageUrl(raw.id),
    title,
    date,
    summary: extractRichText(raw.properties, 'Summary') || undefined,
    tags:
      extractMultiSelectNames(raw.properties, 'Tags').filter(Boolean) ||
      undefined,
    tasks: extractRelationIds(raw.properties, 'Tasks'),
    updatedAt,
  };
}

/**
 * Fetch all pages from a data source with pagination.
 * Uses dataSources.query (SDK v5) with data_source_id.
 */
async function queryAllPages(
  notion: Client,
  dataSourceId: string,
): Promise<RawPage[]> {
  const dataSources = getDataSourcesClient(notion);
  const results: RawPage[] = [];
  let cursor: string | undefined;
  const normalizedId = normalizeNotionId(dataSourceId);
  do {
    const response = await dataSources.query({
      data_source_id: normalizedId,
      start_cursor: cursor,
      page_size: 100,
    });
    if (Array.isArray(response.results)) {
      results.push(...(response.results as RawPage[]));
    }
    cursor = response.next_cursor ?? undefined;
  } while (cursor);
  return results;
}

export type SyncResult = {
  tasks: NotionTaskPage[];
  notes: NotionDailyNotePage[];
};

/**
 * Run full sync: fetch Tasks and Daily Notes from Notion and return typed lists.
 * Uses stored token and database IDs from tokens store.
 */
export async function runSync(): Promise<SyncResult> {
  const tokensStore = getTokensStore();
  const tokens = await tokensStore.read();
  const accessToken = tokens.notionAccessToken;
  if (!accessToken) {
    throw new NotionError(
      'NOTION_TOKEN_MISSING',
      'Notion access token is missing.',
    );
  }

  const dailyNotesDataSourceId =
    tokens.notionDailyNotesDataSourceId ?? tokens.notionDailyNotesDbId;
  const tasksDataSourceId =
    tokens.notionTodosDataSourceId ?? tokens.notionTodosDbId;
  if (!dailyNotesDataSourceId || !tasksDataSourceId) {
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      'Daily Notes or Tasks data source ID missing. Complete Notion setup first.',
    );
  }

  const notion = new Client({ auth: accessToken });
  logger.info('Notion sync started', {
    dailyNotesDataSourceId: dailyNotesDataSourceId.slice(0, 8) + '…',
    tasksDataSourceId: tasksDataSourceId.slice(0, 8) + '…',
  });

  const [rawNotes, rawTasks] = await Promise.all([
    queryAllPages(notion, dailyNotesDataSourceId),
    queryAllPages(notion, tasksDataSourceId),
  ]);

  const notes = rawNotes.map((p) => mapToDailyNotePage(p));
  const tasks = rawTasks.map((p) => mapToTaskPage(p));

  logger.info('Notion sync completed', {
    tasksCount: tasks.length,
    notesCount: notes.length,
  });
  // debug log all the status:[name,...]
  const statuses = tasks.map((t) => t.status).filter(Boolean);
  statuses.forEach((status) => {
    logger.debug(`status:${status}`, {
      name: status,
      ...tasks.filter((t) => t.status === status),
    });
  });
  return { tasks, notes };
}

/**
 * Run tasks-only sync (e.g. for dedup gate freshness).
 */
export async function runTasksSync(): Promise<NotionTaskPage[]> {
  const tokensStore = getTokensStore();
  const tokens = await tokensStore.read();
  const accessToken = tokens.notionAccessToken;
  if (!accessToken) {
    throw new NotionError(
      'NOTION_TOKEN_MISSING',
      'Notion access token is missing.',
    );
  }

  const tasksDataSourceId =
    tokens.notionTodosDataSourceId ?? tokens.notionTodosDbId;
  if (!tasksDataSourceId) {
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      'Tasks data source ID missing. Complete Notion setup first.',
    );
  }

  const notion = new Client({ auth: accessToken });
  const rawTasks = await queryAllPages(notion, tasksDataSourceId);
  return rawTasks.map((p) => mapToTaskPage(p));
}
