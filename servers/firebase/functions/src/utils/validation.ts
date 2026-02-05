/**
 * Request validation for FlowState API endpoints.
 * Validates incoming request bodies against Zod schemas.
 */

import type { Request } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { GenerateRequestSchema } from '@flwst/types';

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/**
 * Thrown when request body fails schema validation.
 */
export class ValidationError extends Error {
  constructor(
    public readonly details: ReturnType<z.ZodError['flatten']>,
    message = 'Validation failed',
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Validates request body against GenerateRequestSchema.
 * @param req - Incoming HTTPS request
 * @returns Parsed and validated GenerateRequest
 * @throws ValidationError when body is invalid
 */
export function validateRequest(req: Request): GenerateRequest {
  const result = GenerateRequestSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError(result.error.flatten(), 'Validation failed');
  }
  return result.data;
}
