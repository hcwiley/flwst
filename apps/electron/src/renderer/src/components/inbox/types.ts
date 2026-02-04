/**
 * Inbox ingestion types for renderer UI state.
 */

import type { RunId } from '@flwst/types';

export type IngestStatus =
  | 'idle'
  | 'reading'
  | 'ingesting'
  | 'generating'
  | 'success'
  | 'error';

export interface InboxIngestResult {
  runId: RunId;
  timestamp: string;
  filename: string;
  rawPath: string;
  cleanPath: string;
  logsPath: string;
  bundlePath: string;
  // LLM output paths
  llmRawPath: string;
  dailyNotePath: string;
  dailyNotePropsPath: string;
  taskFeedPath: string;
  taskFeedPropsPath: string;
  // LLM metadata
  llmDurationMs: number;
  llmSuccess: boolean;
  llmError?: string;
}
