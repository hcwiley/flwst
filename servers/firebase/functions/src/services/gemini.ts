/**
 * Gemini API client for FlowState API server.
 * Uses Vertex AI with IAM-based auth (no API key).
 */

import { GoogleGenAI } from '@google/genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { logger } from 'firebase-functions/logger';

enableFirebaseTelemetry();
/** Vertex AI model ID (hard-coded for now). */
export const MODEL_ID = 'gemini-2.5-flash';

/**
 * Result of a single generateContent call.
 */
export interface GeminiGenerateResult {
  content: string;
  tokenUsage?: { prompt: number; completion: number };
}

/**
 * Create a Vertex AI client using environment variables.
 * Requires: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_GENAI_USE_VERTEXAI.
 */
export function createGenAiClient(project: string, location: string = 'global', useVertexAI: boolean = true): GoogleGenAI {
  if (!project) {
    logger.error('GOOGLE_CLOUD_PROJECT is required for Vertex AI');
    return null as unknown as GoogleGenAI;
  }
  logger.info('Creating GenAI client', { project, location, useVertexAI });
  return new GoogleGenAI({
    vertexai: useVertexAI,
    project,
    location,
  });
}

/**
 * Generate content from prompt + transcript using Vertex AI Gemini.
 * @param prompt - Resolved daily note prompt
 * @param transcript - Preprocessed transcript
 * @returns Generated text and optional token usage
 */
export async function generateContent(
  genaiClient: GoogleGenAI,
  prompt: string,
  transcript: string,
): Promise<GeminiGenerateResult> {
  if (!genaiClient) {
    logger.error('GenAI client is required');
    return null as unknown as GeminiGenerateResult;
  }
  if (!prompt || !transcript) {
    logger.error('Prompt and transcript are required');
    return null as unknown as GeminiGenerateResult;
  }
  const input = `${prompt}\n\n---\n\n${transcript}`;

  const response = await genaiClient.models.generateContent({
    model: MODEL_ID,
    contents: input,
    config: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  });

  const text = response.text ?? '';
  const usage = response.usageMetadata;

  return {
    content: text,
    tokenUsage:
      usage !== undefined
        ? {
            prompt: usage.promptTokenCount ?? 0,
            completion: usage.candidatesTokenCount ?? 0,
          }
        : undefined,
  };
}
