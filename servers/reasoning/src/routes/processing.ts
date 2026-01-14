/**
 * Transcript processing HTTP routes.
 *
 * Exposes a single POST /process endpoint that runs the stateless
 * reasoning pipeline and returns draft objects validated by shared
 * schemas. Designed for direct renderer calls over HTTP.
 */
import { Router } from 'express';
import {
  ProcessTranscriptRequestSchema,
  ProcessTranscriptResponseSchema,
  type ProcessTranscriptResponse,
} from '@flwst/types/src/api/reasoning';
import { runReasoningPipeline } from '../runner.js';

type ProcessingRouterDeps = {
  runPipeline?: (payload: unknown) => Promise<ProcessTranscriptResponse>;
};

export function createProcessingRouter(deps: ProcessingRouterDeps = {}): Router {
  const router = Router();
  const runPipeline = deps.runPipeline ?? runReasoningPipeline;

  router.post('/process', async (req, res) => {
    try {
      const parsed = ProcessTranscriptRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: parsed.error.errors,
        });
      }

      const payload = await runPipeline(parsed.data);
      const validated = ProcessTranscriptResponseSchema.parse(payload);
      return res.json(validated);
    } catch (error: any) {
      console.error('[processing] Error processing transcript:', error);
      return res.status(500).json({
        error: error?.message ?? 'Internal server error',
      });
    }
  });

  return router;
}
