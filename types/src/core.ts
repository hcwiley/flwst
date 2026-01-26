/**
 * Core domain types for FlowState.
 */

import { z } from 'zod';

/**
 * Run ID for idempotent transcript processing.
 * Format: UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
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
 * 
 * Note: These are created as a Select property via the API.
 * Users should convert to Status property in Notion UI for better workflow features.
 * When converted, these will map to:
 * - To-do group: Backlog, To-do, On Deck
 * - In Progress group: In progress, BLOCKED
 * - Complete group: Done, Cancelled
 */
export const TaskStatusSchema = z.enum([
  'Backlog',
  'To-do',
  'On Deck',
  'In progress',
  'BLOCKED',
  'Done',
  'Cancelled',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
