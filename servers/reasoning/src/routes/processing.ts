/**
 * Transcript processing HTTP routes.
 *
 * Creates async processing jobs that can be polled for status so the
 * renderer can handle long-running reasoning steps without timeouts.
 */
import { Router } from 'express';
import {
  ProcessTranscriptJobResponseSchema,
  ProcessTranscriptJobStartResponseSchema,
  ProcessTranscriptRequestSchema,
  type ProcessTranscriptJobStartResponse,
  type ProcessTranscriptRequest,
  type ProcessTranscriptResponse,
} from '@flwst/types/src/api/reasoning';
import { ProcessingJobStore } from '../processing-job-store.js';

type ProcessingRouterDeps = {
  jobStore?: ProcessingJobStore;
  runPipeline?: (payload: ProcessTranscriptRequest) => Promise<ProcessTranscriptResponse>;
};

export function createProcessingRouter(deps: ProcessingRouterDeps = {}): Router {
  const router = Router();
  const jobStore = deps.jobStore ?? new ProcessingJobStore({ runPipeline: deps.runPipeline });

  router.post('/process', async (req, res) => {
    try {
      const parsed = ProcessTranscriptRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: parsed.error.errors,
        });
      }

      const job = jobStore.createJob(parsed.data);
      const response: ProcessTranscriptJobStartResponse = {
        jobId: job.jobId,
        status: job.status,
      };
      return res.status(202).json(ProcessTranscriptJobStartResponseSchema.parse(response));
    } catch (error: any) {
      console.error('[processing] Error processing transcript:', error);
      return res.status(500).json({
        error: error?.message ?? 'Internal server error',
      });
    }
  });

  router.get('/process/:jobId', (req, res) => {
    const job = jobStore.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Unknown processing job' });
    }

    return res.json(ProcessTranscriptJobResponseSchema.parse(job));
  });

  return router;
}
