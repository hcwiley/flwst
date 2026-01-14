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
      reasoningConfig: {
        port: 3000,
        baseUrl: 'http://localhost:3000',
      },
    } as any;
    globalThis.fetch = vi.fn();

    await expect(
      appApi.processTranscript({
        transcript: 'Hello',
        // sessionId missing
      } as any),
    ).rejects.toThrow();
  });

  it('surfaces reasoning server connection errors', async () => {
    globalThis.window = {
      reasoningConfig: {
        port: 3000,
        baseUrl: 'http://localhost:3000',
      },
    } as any;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    await expect(
      appApi.processTranscript({
        transcript: 'Hello',
        sessionId: 'session-1',
      }),
    ).rejects.toThrow('Reasoning server unavailable');
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
