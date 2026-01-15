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

  it('polls until the reasoning job completes', async () => {
    globalThis.window = {
      reasoningConfig: {
        port: 3000,
        baseUrl: 'http://localhost:3000',
      },
    } as any;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/health')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ status: 'ok' }),
        });
      }
      if (url.endsWith('/process')) {
        return Promise.resolve({
          ok: true,
          status: 202,
          json: vi.fn().mockResolvedValue({ jobId: 'job-1', status: 'queued' }),
        });
      }
      if (url.endsWith('/process/job-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            jobId: 'job-1',
            status: 'succeeded',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            result: {
              dailyNoteDraft: {
                localId: 'daily-session-1',
                sessionId: 'session-1',
                dailyNoteRichMarkdown: '# Daily',
              },
              todoDrafts: [
                {
                  id: 'todo-1',
                  localId: 'todo-1',
                  sessionId: 'session-1',
                  text: 'Do the thing',
                  completed: false,
                  matchState: 'new',
                },
              ],
            },
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch url: ${url}`));
    });
    globalThis.fetch = fetchMock;

    const response = await appApi.processTranscript({
      transcript: 'Hello',
      sessionId: 'session-1',
    });

    expect(response.dailyNoteDraft.sessionId).toBe('session-1');
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
