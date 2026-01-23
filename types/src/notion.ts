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
