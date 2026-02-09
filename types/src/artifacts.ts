/**
 * Artifact types for pipeline outputs and persistence.
 */

import { z } from 'zod';

import { RunIdSchema, TaskStatusSchema, TimestampSchema } from './core';

/**
 * Raw transcript artifact.
 */
export const RawTranscriptSchema = z.object({
  runId: RunIdSchema,
  timestamp: TimestampSchema,
  filename: z.string(),
  content: z.string(),
});

export type RawTranscript = z.infer<typeof RawTranscriptSchema>;

/**
 * Cleaned transcript artifact.
 */
export const CleanTranscriptSchema = z.object({
  runId: RunIdSchema,
  timestamp: TimestampSchema,
  originalFilename: z.string(),
  content: z.string(),
  cleanupApplied: z.array(z.string()),
});

export type CleanTranscript = z.infer<typeof CleanTranscriptSchema>;

/**
 * Daily note artifact.
 */
export const DailyNoteSchema = z.object({
  runId: RunIdSchema,
  timestamp: TimestampSchema,
  title: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type DailyNote = z.infer<typeof DailyNoteSchema>;

/**
 * Task artifact.
 */
export const TaskSchema = z.object({
  runId: RunIdSchema,
  timestamp: TimestampSchema,
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: TaskStatusSchema,
  project: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
  assignee: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Task list artifact.
 */
export const TaskListSchema = z.object({
  runId: RunIdSchema,
  timestamp: TimestampSchema,
  tasks: z.array(TaskSchema),
});

export type TaskList = z.infer<typeof TaskListSchema>;

/**
 * Pipeline log entry.
 */
export const LogEntrySchema = z.object({
  timestamp: TimestampSchema,
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

/**
 * Complete artifact bundle for a run.
 */
export const ArtifactBundleSchema = z.object({
  runId: RunIdSchema,
  timestamp: TimestampSchema,
  rawTranscript: RawTranscriptSchema.optional(),
  cleanTranscript: CleanTranscriptSchema.optional(),
  dailyNote: DailyNoteSchema.optional(),
  taskList: TaskListSchema.optional(),
  logs: z.array(LogEntrySchema),
});

export type ArtifactBundle = z.infer<typeof ArtifactBundleSchema>;
