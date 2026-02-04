/**
 * FlowState API server: Firebase Functions for server-mediated LLM calls.
 */

import type { Response } from 'express';
import * as logger from 'firebase-functions/logger';
import type { Request } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';

import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

import { generateContent } from './services/gemini';
import { parseGenerationOutput } from './services/parser';
import { logRequest, logResponse } from './utils/logger';
import { validateRequest, ValidationError } from './utils/validation';

enableFirebaseTelemetry();
const MODEL_ID = 'gemini-3-flash';

logger.info('Vertex enabled:', process.env.GOOGLE_GENAI_USE_VERTEXAI);
logger.info('Cloud location:', process.env.GOOGLE_CLOUD_LOCATION);
logger.info('Cloud project:', process.env.GOOGLE_CLOUD_PROJECT);
logger.info('Model ID:', MODEL_ID);

/**
 * FlowState generate endpoint.
 * POST only. Accepts preprocessed transcript + resolved prompts, returns daily note + task feed.
 */
export const generate = onRequest(
  {
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 120,
  },
  async (request: Request, response: Response) => {
    const startTime = Date.now();
    let runId = 'unknown';

    try {
      if (request.method !== 'POST') {
        response.status(405).json({
          error: 'Method not allowed',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const payload = validateRequest(request);
      runId = payload.runId;

      logRequest({
        runId: payload.runId,
        timestamp: payload.timestamp,
        appVersion: payload.metadata?.appVersion,
        transcriptLength: payload.preprocessedTranscript.length,
        promptLengths: {
          dailyNote: payload.resolvedPrompts.dailyNote.length,
          taskDraft: payload.resolvedPrompts.taskDraft.length,
        },
      });

      const result = await generateContent(
        payload.resolvedPrompts.dailyNote,
        payload.preprocessedTranscript,
        MODEL_ID,
      );

      const parsed = parseGenerationOutput(result.content);
      const durationMs = Date.now() - startTime;

      logResponse({
        runId,
        success: true,
        durationMs,
        model: MODEL_ID,
        tokenUsage: result.tokenUsage,
      });

      response.status(200).json({
        runId: payload.runId,
        timestamp: new Date().toISOString(),
        dailyNote: parsed.dailyNote,
        taskFeed: parsed.taskFeed,
        metadata: {
          model: MODEL_ID,
          durationMs,
          tokenUsage: result.tokenUsage,
        },
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof ValidationError) {
        logResponse({
          runId,
          success: false,
          durationMs,
          model: '',
          errorCode: 'VALIDATION_ERROR',
        });
        response.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details,
        });
        return;
      }

      logger.error('api:generate:error', { runId, error: String(error) });
      logResponse({
        runId,
        success: false,
        durationMs,
        model: '',
        errorCode: 'INTERNAL_ERROR',
      });
      response.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  },
);

/**
 * Health check endpoint.
 */
export const helloWorld = onRequest((request: Request, response: Response) => {
  logger.info('Hello logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});

export { generatePoem } from './genkit-sample';
