import { describe, it, expect } from 'vitest';
import { DailyNoteSchema } from '@flwst/types/src/api/reasoning';

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
});
