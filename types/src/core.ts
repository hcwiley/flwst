/**
 * Core domain types for FlowState.
 */

import { z } from 'zod';

/**
 * Run ID for idempotent transcript processing.
 */
export const RunIdSchema = z.string().uuid();

export type RunId = z.infer<typeof RunIdSchema>;

/**
 * Timestamp in ISO 8601 format.
 */
export const TimestampSchema = z.string().datetime();

export type Timestamp = z.infer<typeof TimestampSchema>;

/**
 * Priority levels for tasks.
 */
export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Task status values.
 */
export const TaskStatusSchema = z.enum([
  'backlog',
  'on-deck',
  'todo',
  'in-progress',
  'blocked',
  'done',
  'archived',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
