/**
 * Subprocess IPC protocol for the reasoning utility.
 *
 * Defines a JSON-lines request/response envelope for Electron main to
 * invoke the reasoning pipeline and receive structured results.
 */
import { z } from 'zod';
import {
  ProcessTranscriptRequestSchema,
  ProcessTranscriptResponseSchema,
  type ProcessTranscriptRequest,
  type ProcessTranscriptResponse,
} from '@flwst/types/src/api/reasoning';

export const SubprocessRequestSchema = z.object({
  id: z.string(),
  type: z.literal('processTranscript'),
  payload: ProcessTranscriptRequestSchema,
});

export type SubprocessRequest = z.infer<typeof SubprocessRequestSchema>;

export type SubprocessSuccessResponse = {
  id: string;
  status: 'success';
  payload: ProcessTranscriptResponse;
};

export type SubprocessErrorResponse = {
  id: string;
  status: 'error';
  error: {
    message: string;
    details?: string;
  };
};

export type SubprocessResponse = SubprocessSuccessResponse | SubprocessErrorResponse;

export function buildSuccessResponse(
  id: string,
  payload: ProcessTranscriptResponse,
): SubprocessSuccessResponse {
  return {
    id,
    status: 'success',
    payload: ProcessTranscriptResponseSchema.parse(payload),
  };
}

export function buildErrorResponse(id: string, error: unknown): SubprocessErrorResponse {
  return {
    id,
    status: 'error',
    error: {
      message: error instanceof Error ? error.message : 'Reasoning pipeline failed',
      details: error instanceof Error ? error.stack : undefined,
    },
  };
}
