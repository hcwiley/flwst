/**
 * Stateless runner tests.
 *
 * Ensures the reasoning runner returns draft payloads that conform
 * to shared Zod schemas for HTTP transport.
 */
import { describe, expect, it } from 'vitest';
import { ProcessTranscriptResponseSchema } from '@flwst/types/src/api/reasoning';
import { runReasoningPipeline } from '../src/runner.js';
import { MockLLMClient, MockNotionClient } from './mocks.js';

describe('runReasoningPipeline', () => {
  it('returns Zod-valid draft payloads', async () => {
    const response = await runReasoningPipeline(
      {
        transcript: 'Test transcript',
        sessionId: 'session-123',
      },
      {
        llmClient: new MockLLMClient(),
        notionClient: new MockNotionClient(),
      },
    );

    expect(() => ProcessTranscriptResponseSchema.parse(response)).not.toThrow();
    expect(response.dailyNoteDraft.sessionId).toBe('session-123');
    expect(response.todoDrafts.length).toBeGreaterThan(0);
  });
});
