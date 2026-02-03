/**
 * IPC handlers for inbox ingestion.
 * Delegates ingest pipeline work to main process to keep renderer lightweight.
 */

import { ipcMain } from 'electron';
import { getLogger } from './sentry';
import type { InboxIngestRequest, InboxIngestResult } from './ingest';
import { ingestTranscript } from './ingest';

/**
 * Register inbox IPC handlers.
 * Should be called after storage is initialized.
 */
export function registerInboxHandlers(): void {
  const logger = getLogger();

  ipcMain.handle(
    'inbox:ingestText',
    async (_event, request: InboxIngestRequest): Promise<InboxIngestResult> => {
      try {
        return await ingestTranscript(request);
      } catch (error) {
        logger.error('Inbox ingest failed', { error });
        throw error;
      }
    },
  );
}
