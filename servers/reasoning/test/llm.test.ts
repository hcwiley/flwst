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
    const updated = applyContextStatusHints(
      [{ text: 'Run flwst locally with a Llama3 backend' }],
      {
        dailyNoteRichMarkdown: '# Daily',
        potentialTodos: [{ text: 'Run flwst locally with a Llama3 backend', context: 'Done' }],
      },
    );

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
    const updated = applyContextStatusHints(
      [{ text: 'Run flwst locally with a Llama3 backend' }],
      {
        dailyNoteRichMarkdown: '# Daily',
        potentialTodos: [
          { text: 'Run flwst locally with a Llama3 backend: Done', context: 'Completed Tasks' },
        ],
      },
    );

    expect(updated[0]?.status).toBe('Done');
  });
});
