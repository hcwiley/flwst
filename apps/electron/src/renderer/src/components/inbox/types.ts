/**
 * Inbox ingestion types for renderer UI state.
 */

import type { RunId } from '@flwst/types';

export type IngestStatus = 'idle' | 'reading' | 'ingesting' | 'success' | 'error';

export interface InboxIngestResult {
  runId: RunId;
  timestamp: string;
  filename: string;
  rawPath: string;
  cleanPath: string;
  logsPath: string;
  bundlePath: string;
}
