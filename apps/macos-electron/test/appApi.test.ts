/**
 * IPC facade contract tests.
 *
 * Ensures Zod validation rejects invalid payloads and responses.
 */
import { describe, expect, it, vi } from 'vitest';
import { appApi } from '../src/appApi.js';

describe('appApi', () => {
  it('rejects invalid processTranscript requests', async () => {
    globalThis.window = {
      ipcRenderer: {
        invoke: vi.fn(),
      },
    } as any;

    await expect(
      appApi.processTranscript({
        transcript: 'Hello',
        // sessionId missing
      } as any),
    ).rejects.toThrow();
  });

  it('rejects invalid responses', async () => {
    globalThis.window = {
      ipcRenderer: {
        invoke: vi.fn().mockResolvedValue({}),
      },
    } as any;

    await expect(appApi.bootstrapMirror()).rejects.toThrow();
  });
});
