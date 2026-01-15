/**
 * Processing route tests.
 *
 * Verifies HTTP validation and response shapes for /process.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  ProcessTranscriptJobResponseSchema,
  ProcessTranscriptJobStartResponseSchema,
  ProcessTranscriptResponseSchema,
} from '@flwst/types/src/api/reasoning';
import { ProcessingJobStore } from '../src/processing-job-store.js';
import { createProcessingRouter } from '../src/routes/processing.js';

describe('processing routes', () => {
  it('returns a job id for /process and allows polling', async () => {
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
    const jobStore = new ProcessingJobStore({ runPipeline });
    const app = express();
    app.use(express.json());
    app.use(createProcessingRouter({ jobStore }));

    const response = await request(app).post('/process').send({
      transcript: 'hello',
      sessionId: 'session-1',
    });

    expect(response.status).toBe(202);
    expect(() => ProcessTranscriptJobStartResponseSchema.parse(response.body)).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));

    const statusResponse = await request(app).get(`/process/${response.body.jobId}`);
    expect(statusResponse.status).toBe(200);
    expect(() => ProcessTranscriptJobResponseSchema.parse(statusResponse.body)).not.toThrow();
    expect(runPipeline).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid /process payloads', async () => {
    const runPipeline = vi.fn();
    const jobStore = new ProcessingJobStore({ runPipeline });
    const app = express();
    app.use(express.json());
    app.use(createProcessingRouter({ jobStore }));

    const response = await request(app).post('/process').send({ transcript: 'missing session' });

    expect(response.status).toBe(400);
    expect(runPipeline).not.toHaveBeenCalled();
  });
});
