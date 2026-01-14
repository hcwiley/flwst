/**
 * Processing route tests.
 *
 * Verifies HTTP validation and response shapes for /process.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ProcessTranscriptResponseSchema } from '@flwst/types/src/api/reasoning';
import { createProcessingRouter } from '../src/routes/processing.js';

describe('processing routes', () => {
  it('returns validated drafts for /process', async () => {
    const responsePayload = ProcessTranscriptResponseSchema.parse({
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
      matchSuggestions: [
        {
          localId: 'todo-1',
          matchState: 'new',
          confidence: 0.2,
          reason: 'No match found',
        },
      ],
    });

    const runPipeline = vi.fn().mockResolvedValue(responsePayload);
    const app = express();
    app.use(express.json());
    app.use(createProcessingRouter({ runPipeline }));

    const response = await request(app).post('/process').send({
      transcript: 'hello',
      sessionId: 'session-1',
    });

    expect(response.status).toBe(200);
    expect(() => ProcessTranscriptResponseSchema.parse(response.body)).not.toThrow();
    expect(runPipeline).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid /process payloads', async () => {
    const runPipeline = vi.fn();
    const app = express();
    app.use(express.json());
    app.use(createProcessingRouter({ runPipeline }));

    const response = await request(app).post('/process').send({ transcript: 'missing session' });

    expect(response.status).toBe(400);
    expect(runPipeline).not.toHaveBeenCalled();
  });
});
