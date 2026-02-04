/**
 * IPC handlers for LLM (server-mediated generate) calls.
 */

import { ipcMain } from 'electron';
import { getLogger } from './sentry';
import { FlwstApiClient } from './api/flwstApi';
import type { GenerateRequest, GenerateResponse } from '@flwst/types';

const API_BASE_URL = process.env.FLWST_API_URL ?? 'https://flwst-dev.web.app';

const client = new FlwstApiClient({
  baseUrl: API_BASE_URL,
  timeout: 120_000,
});

/**
 * Register LLM IPC handlers.
 * Should be called after app is ready.
 */
export function registerLlmHandlers(): void {
  const logger = getLogger();

  ipcMain.handle(
    'llm:generate',
    async (_event, request: GenerateRequest): Promise<GenerateResponse> => {
      try {
        return await client.generate(request);
      } catch (error) {
        logger.error('LLM generate failed', { error });
        throw error;
      }
    },
  );
}
