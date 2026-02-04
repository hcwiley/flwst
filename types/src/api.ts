/**
 * API request/response schemas for FlowState server-mediated LLM calls.
 * Used by both Firebase Functions and Electron client.
 */

import { z } from 'zod';

import { RunIdSchema, TimestampSchema } from './core';

/**
 * Request payload from client to /generate endpoint.
 */
export const GenerateRequestSchema = z.object({
  runId: RunIdSchema,
  timestamp: TimestampSchema,
  preprocessedTranscript: z.string().min(1),
  resolvedPrompts: z.object({
    dailyNote: z.string().min(1),
    taskDraft: z.string().min(1),
  }),
  metadata: z
    .object({
      appVersion: z.string(),
      preprocessEnabled: z.boolean(),
    })
    .optional(),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/**
 * Daily note props from [[DAILY_NOTE_PROPS]] block.
 */
export const DailyNotePropsSchema = z.object({
  name: z.string(),
  date: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
});

export type DailyNoteProps = z.infer<typeof DailyNotePropsSchema>;

/**
 * Single task row from [[TASK_FEED_PROPS]] table.
 */
export const TaskPropsSchema = z.object({
  name: z.string(),
  project: z.string().optional(),
  description: z.string().optional(),
  priority: z.string(),
  status: z.string(),
  tags: z.array(z.string()),
  due: z.string().optional(),
});

export type TaskProps = z.infer<typeof TaskPropsSchema>;

/**
 * Response payload from /generate endpoint to client.
 */
export const GenerateResponseSchema = z.object({
  runId: RunIdSchema,
  timestamp: TimestampSchema,
  dailyNote: z.object({
    content: z.string(),
    props: DailyNotePropsSchema,
  }),
  taskFeed: z.object({
    content: z.string(),
    taskCount: z.number(),
    props: z.array(TaskPropsSchema),
  }),
  metadata: z.object({
    model: z.string(),
    durationMs: z.number(),
    tokenUsage: z
      .object({
        prompt: z.number(),
        completion: z.number(),
      })
      .optional(),
  }),
});

export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

/**
 * Error response from API.
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.enum([
    'VALIDATION_ERROR',
    'LLM_ERROR',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
  ]),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
