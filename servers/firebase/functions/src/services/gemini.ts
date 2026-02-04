/**
 * Gemini API client for FlowState API server.
 * Uses Vertex AI with IAM-based auth (no API key).
 */

import { GoogleGenAI } from '@google/genai';

/** Vertex AI model ID (verify in Vertex model list for your project). */
const MODEL = 'gemini-3-flash';

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
function createClient(): GoogleGenAI {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  if (!project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required for Vertex AI');
  }
  return new GoogleGenAI({
    vertexai: true,
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
  prompt: string,
  transcript: string,
  modelId: string = MODEL,
): Promise<GeminiGenerateResult> {
  const ai = createClient();
  const input = `${prompt}\n\n---\n\n${transcript}`;

  const response = await ai.models.generateContent({
    model: modelId,
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
