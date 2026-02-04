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

  it('maps completed=true to status=Done when status is missing', () => {
    const response = buildDraftResponse('session-1', {
      dailyNoteRichMarkdown: '# Daily',
      todos: [
        {
          id: 'todo-1',
          text: 'Completed task without explicit status',
          completed: true,
          // status is intentionally undefined
        },
      ],
    });

    expect(response.todoDrafts[0]?.status).toBe('Done');
    expect(response.todoDrafts[0]?.completed).toBe(true);
  });

  it('preserves explicit status when completed is true', () => {
    const response = buildDraftResponse('session-1', {
      dailyNoteRichMarkdown: '# Daily',
      todos: [
        {
          id: 'todo-1',
          text: 'Task with both status and completed',
          completed: true,
          status: 'In Progress', // Explicit status should be preserved
        },
      ],
    });

    expect(response.todoDrafts[0]?.status).toBe('In Progress');
    expect(response.todoDrafts[0]?.completed).toBe(true);
  });

  it('preserves Done status when todo already has status set', () => {
    const response = buildDraftResponse('session-1', {
      dailyNoteRichMarkdown: '# Daily',
      todos: [
        {
          id: 'todo-1',
          text: 'Task already marked as Done',
          completed: true,
          status: 'Done', // Explicit status should be preserved
        },
      ],
    });

    expect(response.todoDrafts[0]?.status).toBe('Done');
    expect(response.todoDrafts[0]?.completed).toBe(true);
  });

  it('ensures status persists in draft when completed is true and status is Done', () => {
    // This test verifies that a todo marked as done maintains its status through conversion
    const response = buildDraftResponse('session-submit-test', {
      dailyNoteRichMarkdown: '# Daily Note',
      todos: [
        {
          id: 'todo-done',
          text: 'Completed task that should stay Done',
          completed: true,
          status: 'Done',
          isMatched: true,
          notionId: 'notion-123',
        },
      ],
    });

    const draft = response.todoDrafts[0];
    expect(draft).toBeDefined();
    expect(draft?.status).toBe('Done');
    expect(draft?.completed).toBe(true);
    expect(draft?.matchState).toBe('matched');
    expect(draft?.notionTargetId).toBe('notion-123');
  });
});
