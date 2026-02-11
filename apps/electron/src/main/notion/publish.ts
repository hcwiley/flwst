/**
 * Publish draft tasks to Notion: create new pages, update existing, or skip per dedup gate.
 * Orchestrates runTasksSync -> runDedupGate -> create/update writes -> full re-sync and broadcast.
 */

import { Client } from '@notionhq/client';
import type {
  DraftDailyNote,
  NotionTaskPage,
  NotionDailyNotePage,
  PublishPayload,
  PublishResult,
} from '@flwst/types';
import { getLogger } from '../sentry';
import { getTokensStore } from '../storage';
import { normalizeNotionId } from './notionSchema';
import { normalizePriority, normalizeStatus } from './normalize';
import { maybeAddAssignee, type NotionWriteProps } from './writeGuards';
import { runDedupGate, type DraftTask } from './dedup';
import { runDailyNotesSync, runSync, runTasksSync } from './sync';
import { NotionError } from './errors';
import { BrowserWindow } from 'electron';

const logger = getLogger();

/**
 * Build Notion page properties from a draft task for create or update.
 * Applies normalization for status/priority and write guards for assignee.
 */
function buildTaskProperties(draft: DraftTask): NotionWriteProps {
  const status = normalizeStatus(draft.status) ?? 'To-do';
  const priority = normalizePriority(draft.priority) ?? 'medium';

  const props: NotionWriteProps = {
    Name: {
      title: [{ text: { content: draft.name.trim() || 'Untitled' } }],
    },
    Status: { status: { name: status } },
    Priority: { select: { name: priority } },
  };

  if (draft.description !== undefined && draft.description !== '') {
    props.Description = {
      rich_text: [{ text: { content: draft.description } }],
    };
  }
  if (draft.project !== undefined && draft.project !== '') {
    props.Project = { select: { name: draft.project } };
  }
  if (draft.tags !== undefined && draft.tags.length > 0) {
    props.Tags = {
      multi_select: draft.tags.map((name) => ({ name })),
    };
  }
  if (draft.due !== undefined && draft.due !== '') {
    props['Due Date'] = { date: { start: draft.due } };
  }
  if (draft.sourceRunId !== undefined && draft.sourceRunId !== '') {
    props['Source Run ID'] = {
      rich_text: [{ text: { content: draft.sourceRunId } }],
    };
  }

  maybeAddAssignee(props, draft.assignee);
  return props;
}

/**
 * Build Notion page properties from a draft daily note for create.
 */
function buildDailyNoteProperties(
  note: DraftDailyNote,
  taskIds: string[],
): NotionWriteProps {
  const props: NotionWriteProps = {
    Name: {
      title: [{ text: { content: note.name.trim() || 'Daily Note' } }],
    },
    Date: { date: { start: note.date } },
    Summary: { rich_text: [{ text: { content: note.summary } }] },
  };

  if (note.tags.length > 0) {
    props.Tags = { multi_select: note.tags.map((name) => ({ name })) };
  }
  if (note.sourceRunId) {
    props['Source Run ID'] = {
      rich_text: [{ text: { content: note.sourceRunId } }],
    };
  }
  if (taskIds.length > 0) {
    props.Tasks = { relation: taskIds.map((id) => ({ id })) };
  }

  return props;
}

/**
 * Build Notion blocks from markdown/plain text.
 * Supports headings, bulleted/numbered lists, and paragraphs.
 */
function buildDailyNoteBlocks(
  content?: string,
): Array<Record<string, unknown>> {
  if (!content) return [];

  const blocks: Array<Record<string, unknown>> = [];
  const lines = content.split(/\r?\n/);
  let buffer: string[] = [];

  const flushParagraph = (): void => {
    const text = buffer.join(' ').trim();
    if (!text) {
      buffer = [];
      return;
    }
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: text } }],
      },
    });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      blocks.push({
        object: 'block',
        type: `heading_${level}`,
        [`heading_${level}`]: {
          rich_text: [{ type: 'text', text: { content: text } }],
        },
      });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      const text = bulletMatch[1].trim();
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: text } }],
        },
      });
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      const text = numberedMatch[1].trim();
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ type: 'text', text: { content: text } }],
        },
      });
      continue;
    }

    buffer.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

/**
 * Create a single task page in the Tasks data source.
 * Uses data_source_id (not database_id) so the stored Tasks data source ID works.
 */
export async function createTaskPage(
  notion: Client,
  dataSourceId: string,
  draft: DraftTask,
): Promise<string> {
  const normalizedId = normalizeNotionId(dataSourceId);
  const properties = buildTaskProperties(draft);

  const response = await notion.pages.create({
    parent: { type: 'data_source_id', data_source_id: normalizedId },
    properties,
  } as never);
  return response.id;
}

/**
 * Update an existing task page with draft properties.
 */
export async function updateTaskPage(
  notion: Client,
  pageId: string,
  draft: DraftTask,
): Promise<void> {
  const normalizedId = normalizeNotionId(pageId);
  const properties = buildTaskProperties(draft);

  await notion.pages.update({
    page_id: normalizedId,
    properties,
  } as never);
}

/**
 * Create a daily note page in the Daily Notes data source.
 */
export async function createDailyNotePage(
  notion: Client,
  dataSourceId: string,
  note: DraftDailyNote,
  taskIds: string[],
): Promise<string> {
  const normalizedId = normalizeNotionId(dataSourceId);
  const properties = buildDailyNoteProperties(note, taskIds);
  const children = buildDailyNoteBlocks(note.content);

  const response = await notion.pages.create({
    parent: { type: 'data_source_id', data_source_id: normalizedId },
    properties,
    ...(children.length > 0 ? { children } : {}),
  } as never);

  return response.id;
}

/**
 * Update an existing daily note page properties.
 * We avoid re-appending content on update to prevent duplicates.
 */
export async function updateDailyNotePage(
  notion: Client,
  pageId: string,
  note: DraftDailyNote,
  taskIds: string[],
): Promise<void> {
  const normalizedId = normalizeNotionId(pageId);
  const properties = buildDailyNoteProperties(note, taskIds);

  await notion.pages.update({
    page_id: normalizedId,
    properties,
  } as never);
}

async function updateTaskDailyNotesRelation(
  notion: Client,
  taskId: string,
  dailyNoteId: string,
  existingRelationIds: string[],
): Promise<void> {
  const normalizedTaskId = normalizeNotionId(taskId);
  const normalizedNoteId = normalizeNotionId(dailyNoteId);
  const uniqueIds = Array.from(
    new Set([...existingRelationIds, normalizedNoteId]),
  );

  await notion.pages.update({
    page_id: normalizedTaskId,
    properties: {
      'Daily Notes': {
        relation: uniqueIds.map((id) => ({ id })),
      },
    },
  } as never);
}

/**
 * Publish draft tasks: sync snapshot -> dedup -> create/update/skip -> re-sync and broadcast.
 * Returns counts and per-draft details.
 */
export async function publishDrafts(
  payload: PublishPayload,
): Promise<PublishResult> {
  const drafts = payload.tasks;
  const dailyNote = payload.dailyNote;
  const details: PublishResult['details'] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let dailyNoteResult: PublishResult['dailyNote'];
  const createdTaskIds: string[] = [];
  const updatedTaskIds: string[] = [];

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
  const dailyNotesDataSourceId =
    tokens.notionDailyNotesDataSourceId ?? tokens.notionDailyNotesDbId;
  if (drafts.length > 0 && !tasksDataSourceId) {
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      'Tasks data source ID missing. Complete Notion setup first.',
    );
  }
  if (dailyNote && !dailyNotesDataSourceId) {
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      'Daily Notes data source ID missing. Complete Notion setup first.',
    );
  }

  logger.info('Publish drafts starting', {
    draftCount: drafts.length,
    hasDailyNote: !!dailyNote,
  });

  const notion = new Client({ auth: accessToken });

  const tasks = await runTasksSync();
  const tasksById: Record<string, NotionTaskPage> = {};
  for (const t of tasks) tasksById[t.id] = t;

  const results = runDedupGate(drafts, tasksById);

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const result = results[i];
    const detail: PublishResult['details'][number] = { draft, result };

    if (result.action === 'create') {
      try {
        const id = await createTaskPage(
          notion,
          tasksDataSourceId as string,
          draft,
        );
        created++;
        createdTaskIds.push(id);
        logger.debug('Created task', { title: draft.name });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        detail.error = msg;
        logger.error('Create task failed', { draft: draft.name, error });
      }
    } else if (result.action === 'update' && result.matchedTaskId) {
      try {
        await updateTaskPage(notion, result.matchedTaskId, draft);
        updated++;
        updatedTaskIds.push(result.matchedTaskId);
        logger.debug('Updated task', {
          title: draft.name,
          id: result.matchedTaskId,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        detail.error = msg;
        logger.error('Update task failed', {
          draft: draft.name,
          id: result.matchedTaskId,
          error,
        });
      }
    } else {
      skipped++;
      logger.debug('Skipped task', {
        title: draft.name,
        reason: result.reason,
        draft: draft,
      });
    }

    details.push(detail);
  }

  const relatedTaskIds = Array.from(
    new Set([...createdTaskIds, ...updatedTaskIds]),
  );

  if (dailyNote && dailyNotesDataSourceId) {
    try {
      let existing: NotionDailyNotePage | undefined;
      if (dailyNote.sourceRunId) {
        const notes = await runDailyNotesSync();
        existing = notes.find(
          (note) => note.sourceRunId === dailyNote.sourceRunId,
        );
      }

      if (existing) {
        await updateDailyNotePage(
          notion,
          existing.id,
          dailyNote,
          relatedTaskIds,
        );
        dailyNoteResult = { id: existing.id };
        logger.info('Updated daily note', {
          id: existing.id,
          title: dailyNote.name,
        });
      } else {
        const id = await createDailyNotePage(
          notion,
          dailyNotesDataSourceId,
          dailyNote,
          relatedTaskIds,
        );
        dailyNoteResult = { id };
        logger.info('Created daily note', { id, title: dailyNote.name });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      dailyNoteResult = { error: msg };
      logger.error('Create daily note failed', { error });
    }
  }

  if (dailyNoteResult?.id && relatedTaskIds.length > 0) {
    for (const taskId of relatedTaskIds) {
      const existing = tasksById[taskId];
      const existingIds = existing?.dailyNotes ?? [];
      try {
        await updateTaskDailyNotesRelation(
          notion,
          taskId,
          dailyNoteResult.id,
          existingIds,
        );
      } catch (error) {
        logger.error('Update task daily note relation failed', {
          taskId,
          error,
        });
      }
    }
  }

  logger.info('Publish drafts completed', {
    created,
    updated,
    skipped,
    dailyNote: dailyNoteResult,
  });

  const syncResult = await runSync();
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('notion:syncComplete', {
      success: true,
      tasks: syncResult.tasks,
      notes: syncResult.notes,
    });
  });

  return {
    created,
    updated,
    skipped,
    details,
    dailyNote: dailyNoteResult,
  };
}
