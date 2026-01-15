/**
 * Stateless runner tests.
 *
 * Ensures the reasoning runner returns draft payloads that conform
 * to shared Zod schemas for HTTP transport.
 */
import { describe, expect, it } from 'vitest';
import { ProcessTranscriptResponseSchema } from '@flwst/types/src/api/reasoning';
import { buildDraftResponse, runReasoningPipeline } from '../src/runner.js';
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

  it('normalizes status and priority values', () => {
    const response = buildDraftResponse('session-1', {
      dailyNoteRichMarkdown: '# Daily',
      todos: [
        {
          id: 'todo-1',
          text: 'Email Knud about teaching in the fall',
          completed: false,
          status: 'In progress',
          priority: 'high',
        },
      ],
    });

    expect(response.todoDrafts[0]?.status).toBe('In Progress');
    expect(response.todoDrafts[0]?.priority).toBe('High');
  });
});
