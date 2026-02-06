/**
 * FlowState API client for server-mediated LLM calls.
 * Calls Firebase Functions /generate endpoint.
 */

import { logger } from '@flwst/core';
import type { ApiError, GenerateRequest, GenerateResponse } from '@flwst/types';

const DEFAULT_TIMEOUT_MS = 120_000;

export interface FlwstApiClientConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * Thrown when the API returns an error response.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

/**
 * Client for FlowState generate endpoint.
 */
export class FlwstApiClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: FlwstApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    logger.info('FlwstApiClient initialized', {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
    });
  }

  /**
   * Call /generate endpoint with preprocessed transcript and resolved prompts.
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      const body = (await response.json()) as GenerateResponse | ApiError;

      if (!response.ok) {
        const err = body as ApiError;
        throw new ApiClientError(
          err.code,
          err.error ?? response.statusText,
          err.details,
        );
      }

      return body as GenerateResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
