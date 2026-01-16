import { describe, it, expect } from 'vitest';
import { DailyNoteSchema } from '@flwst/types/src/api/reasoning';
import { applyContextStatusHints, inferStatusFromContext } from '../src/llm-client.js';

describe('LLM Model Tests', () => {
  it('should validate daily note schema', () => {
    const validData = {
      dailyNoteRichMarkdown: '# Test Note',
      todos: [{ id: '1', text: 'Test todo', completed: false }],
      discoveredTodos: [],
    };

    const result = DailyNoteSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid daily note data', () => {
    const invalidData = {
      dailyNoteRichMarkdown: '# Test',
      // missing todos field
    };

    const result = DailyNoteSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('infers Done status from context', () => {
    expect(inferStatusFromContext('Done')).toBe('Done');
    expect(inferStatusFromContext('Completed')).toBe('Done');
  });

  it('applies status hints when missing', () => {
    const updated = applyContextStatusHints([{ text: 'Run flwst locally with a Llama3 backend' }], {
      dailyNoteRichMarkdown: '# Daily',
      potentialTodos: [{ text: 'Run flwst locally with a Llama3 backend', context: 'Done' }],
    });

    expect(updated[0]?.status).toBe('Done');
  });

  it('overrides status when context conflicts', () => {
    const updated = applyContextStatusHints(
      [{ text: 'Run flwst locally with a Llama3 backend', status: 'In Progress' }],
      {
        dailyNoteRichMarkdown: '# Daily',
        potentialTodos: [{ text: 'Run flwst locally with a Llama3 backend', context: 'Completed' }],
      },
    );

    expect(updated[0]?.status).toBe('Done');
  });

  it('applies context when high-level text includes status suffix', () => {
    const updated = applyContextStatusHints([{ text: 'Run flwst locally with a Llama3 backend' }], {
      dailyNoteRichMarkdown: '# Daily',
      potentialTodos: [
        { text: 'Run flwst locally with a Llama3 backend: Done', context: 'Completed Tasks' },
      ],
    });

    expect(updated[0]?.status).toBe('Done');
  });
});

/**
 * Integration test for multi-date extraction
 *
 * This test validates that Step 1 extraction correctly splits multi-date lists
 * into multiple potential tasks. Run with TEST_TYPE=integration.
 */
describe.skipIf(process.env.TEST_TYPE !== 'integration')(
  'Multi-date extraction (integration)',
  () => {
    it('should split multi-date cancel statements into multiple tasks', async () => {
      const { LlamaLLMClient } = await import('../src/llm-client.js');

      const transcript = `The Instagram post for Example Project for November 22nd, November 23rd, and November 17th can all be cancelled.`;

      const llmClient = new LlamaLLMClient();
      const result = await llmClient.extractHighLevelNotes(transcript);

      // Should extract 3 separate tasks, one for each date
      expect(result.potentialTodos.length).toBeGreaterThanOrEqual(3);

      // Each task should mention a specific date
      const dateMentions = result.potentialTodos.filter(
        (todo) =>
          todo.text.includes('November 22') ||
          todo.text.includes('November 23') ||
          todo.text.includes('November 17'),
      );
      expect(dateMentions.length).toBeGreaterThanOrEqual(3);

      // All should be cancel-related
      const cancelTasks = result.potentialTodos.filter((todo) =>
        todo.text.toLowerCase().includes('cancel'),
      );
      expect(cancelTasks.length).toBeGreaterThanOrEqual(3);
    }, 60000); // 1 minute timeout for LLM call
  },
);
