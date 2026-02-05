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
