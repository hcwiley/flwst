/**
 * Notion API types and schemas.
 */

import { z } from 'zod';
import { PrioritySchema, TaskStatusSchema } from './core';

/**
 * Notion page reference.
 */
export const NotionPageRefSchema = z.object({
  id: z.string(),
  url: z.string().url(),
});

export type NotionPageRef = z.infer<typeof NotionPageRefSchema>;

/**
 * Notion database reference.
 */
export const NotionDatabaseRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
});

export type NotionDatabaseRef = z.infer<typeof NotionDatabaseRefSchema>;

/**
 * Notion task page data.
 */
export const NotionTaskPageSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  priority: PrioritySchema,
  status: TaskStatusSchema,
  project: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  assignee: z.string().optional(),
  dailyNotes: z.array(z.string()),
  updatedAt: z.string().datetime(),
});

export type NotionTaskPage = z.infer<typeof NotionTaskPageSchema>;

/**
 * Notion daily note page data.
 */
export const NotionDailyNotePageSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  date: z.string(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tasks: z.array(z.string()),
  sourceRunId: z.string().optional(),
  updatedAt: z.string().datetime(),
});

export type NotionDailyNotePage = z.infer<typeof NotionDailyNotePageSchema>;

/**
 * Sync metadata for a single sync run.
 */
export const NotionSyncErrorSchema = z.object({
  message: z.string(),
  at: z.string(),
});

export type NotionSyncError = z.infer<typeof NotionSyncErrorSchema>;

/**
 * Notion sync state: canonical snapshot of tasks and daily notes plus sync metadata.
 */
export const NotionSyncStateSchema = z.object({
  lastSyncAt: z.string().datetime().optional(),
  isSyncing: z.boolean(),
  lastError: NotionSyncErrorSchema.nullable().optional(),
  tasksById: z.record(z.string(), NotionTaskPageSchema),
  notesById: z.record(z.string(), NotionDailyNotePageSchema),
});

export type NotionSyncState = z.infer<typeof NotionSyncStateSchema>;

/**
 * Result of dedup gate for a single draft task: create, update, or skip.
 */
export const DedupResultSchema = z.object({
  action: z.enum(['create', 'update', 'skip']),
  matchedTaskId: z.string().optional(),
  reason: z.string(),
});

export type DedupResult = z.infer<typeof DedupResultSchema>;

/**
 * Draft task shape for publish input (matches ingest TaskProps).
 */
export const DraftTaskSchema = z.object({
  name: z.string(),
  project: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  due: z.string().optional(),
  assignee: z.string().optional(),
  sourceRunId: z.string().optional(),
});

export type DraftTask = z.infer<typeof DraftTaskSchema>;

/**
 * Draft daily note shape for publish input (matches DailyNoteProps).
 */
export const DraftDailyNoteSchema = z.object({
  name: z.string(),
  date: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  content: z.string().optional(),
  sourceRunId: z.string().optional(),
});

export type DraftDailyNote = z.infer<typeof DraftDailyNoteSchema>;

/**
 * Publish payload: tasks plus optional daily note.
 */
export const PublishPayloadSchema = z.object({
  tasks: z.array(DraftTaskSchema),
  dailyNote: DraftDailyNoteSchema.optional(),
});

export type PublishPayload = z.infer<typeof PublishPayloadSchema>;

/**
 * Per-draft outcome for publish result details.
 */
export const PublishDetailSchema = z.object({
  draft: DraftTaskSchema,
  result: DedupResultSchema,
  error: z.string().optional(),
});

export type PublishDetail = z.infer<typeof PublishDetailSchema>;

/**
 * Result of publishing draft tasks to Notion (create/update/skip counts + details).
 */
export const PublishResultSchema = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  details: z.array(PublishDetailSchema),
  dailyNote: z
    .object({
      id: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
});

export type PublishResult = z.infer<typeof PublishResultSchema>;
