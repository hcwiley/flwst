/**
 * FlowState API server: Firebase Functions for server-mediated LLM calls.
 */

import type { Response } from 'express';
import * as logger from 'firebase-functions/logger';
import type { Request } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';

import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

import {
  createGenAiClient,
  generateContent,
  MODEL_ID,
} from './services/gemini';
import { parseGenerationOutput } from './services/parser';
import { logRequest, logResponse } from './utils/logger';
import { validateRequest, ValidationError } from './utils/validation';

enableFirebaseTelemetry();

const getProjectId = (): string => {
  if (process.env.GCLOUD_PROJECT) {
    return process.env.GCLOUD_PROJECT;
  }

  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return process.env.GOOGLE_CLOUD_PROJECT;
  }

  if (process.env.FIREBASE_CONFIG) {
    return JSON.parse(process.env.FIREBASE_CONFIG).projectId;
  }

  throw new Error('Unable to determine project ID');
};

const getGenAiClient = () => {
  const useVertexAI =
    process.env.GOOGLE_GENAI_USE_VERTEXAI?.toLowerCase() === 'true';
  const project = getProjectId();
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';

  logger.info('Vertex enabled:', useVertexAI);
  logger.info('Cloud location:', location);
  logger.info('Cloud project:', project);
  logger.info('Model ID:', MODEL_ID);

  return createGenAiClient(project, location, useVertexAI);
};

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
    const genaiClient = getGenAiClient();
    if (!genaiClient) {
      response.status(500).json({
        error: 'Failed to create GenAI client',
        code: 'INTERNAL_ERROR',
      });
      return;
    }
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
        genaiClient,
        payload.resolvedPrompts.dailyNote,
        payload.preprocessedTranscript,
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
