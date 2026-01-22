/**
 * Configuration types for user settings and prompts.
 */

import { z } from 'zod';
import { PrioritySchema, TaskStatusSchema } from './core';

/**
 * User configuration schema.
 */
export const UserConfigSchema = z.object({
  cleanup: z.object({
    enabled: z.boolean(),
    ignoreList: z.array(z.string()),
    dictionary: z.record(z.string(), z.string()),
  }),
  prompts: z.object({
    dailyNote: z.string().min(1),
    taskList: z.string().min(1),
    cleanup: z.string().optional(),
  }),
  notion: z.object({
    flowStatePageId: z.string().optional(),
    dailyNotesDbId: z.string().optional(),
    todosDbId: z.string().optional(),
  }),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;

/**
 * Integration configuration types.
 */
export const NotionConfigSchema = z.object({
  accessToken: z.string(),
  flowStatePageId: z.string(),
  dailyNotesDbId: z.string(),
  todosDbId: z.string(),
});

export type NotionConfig = z.infer<typeof NotionConfigSchema>;

export const FirebaseConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().optional(),
});

export type FirebaseConfig = z.infer<typeof FirebaseConfigSchema>;

export const GeminiConfigSchema = z.object({
  apiKey: z.string(),
  model: z.string().default('gemini-3-flash-preview'),
});

export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;

export const SentryConfigSchema = z.object({
  dsn: z.string().url().optional(),
  environment: z.string().default('development'),
});

export type SentryConfig = z.infer<typeof SentryConfigSchema>;

export const AmplitudeConfigSchema = z.object({
  apiKey: z.string().optional(),
  userId: z.string().optional(),
});

export type AmplitudeConfig = z.infer<typeof AmplitudeConfigSchema>;

/**
 * Notion database schema definitions.
 */
export const NotionDailyNoteSchemaSchema = z.object({
  name: z.string(),
  date: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  tasks: z.array(z.string()),
});

export type NotionDailyNoteSchema = z.infer<typeof NotionDailyNoteSchemaSchema>;

export const NotionTaskSchemaSchema = z.object({
  name: z.string(),
  project: z.string().optional(),
  description: z.string().optional(),
  priority: PrioritySchema,
  status: TaskStatusSchema,
  tags: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  assignee: z.string().optional(),
  dailyNotes: z.array(z.string()),
});

export type NotionTaskSchema = z.infer<typeof NotionTaskSchemaSchema>;
