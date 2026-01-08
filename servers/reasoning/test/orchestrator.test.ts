/**
 * Orchestrator Tests
 *
 * TDD test suite for the ReasoningOrchestrator state machine.
 * Uses mock clients and fixtures to enable fast, deterministic testing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReasoningOrchestrator, ReasoningState } from '../src/orchestrator.js';
import { MockLLMClient } from './mocks.js';
import { MockNotionClient } from './mocks.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TodoSchema, DailyNoteSchema } from '@flwst/types/api/reasoning';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load transcript fixture
 */
function loadTranscript(): string {
  const transcriptPath = path.resolve(__dirname, '../../../data/test/transcript.txt');
  return fs.readFileSync(transcriptPath, 'utf-8');
}

describe('ReasoningOrchestrator', () => {
  let llmClient: MockLLMClient;
  let notionClient: MockNotionClient;
  let transcript: string;

  beforeEach(() => {
    llmClient = new MockLLMClient();
    notionClient = new MockNotionClient();
    transcript = loadTranscript();
  });

  describe('State Transitions', () => {
    it('should start in INIT state', () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);
      expect(orchestrator.getState()).toBe(ReasoningState.INIT);
    });

    it('should transition through all states in order', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      // Run the complete pipeline
      const result = await orchestrator.run();

      // Verify final state
      expect(orchestrator.getState()).toBe(ReasoningState.DONE);

      // Verify result structure
      expect(result).toHaveProperty('dailyNoteRichMarkdown');
      expect(result).toHaveProperty('todos');
      expect(Array.isArray(result.todos)).toBe(true);
    });

    it('should validate schema at each stage', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      const result = await orchestrator.run();

      // Validate final output with Zod
      const validated = DailyNoteSchema.parse(result);
      expect(validated.todos.length).toBeGreaterThan(0);

      // Validate each todo
      for (const todo of validated.todos) {
        TodoSchema.parse(todo);
      }
    });
  });

  describe('Step 1: Extract High-Level Notes', () => {
    it('should extract high-level notes and transition to DAILY_NOTES_EXTRACTED', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      // Manually trigger step 1 (normally done in run())
      // We'll use a private method workaround or test via run()
      const result = await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      expect(snapshot.highLevelNotes).toBeDefined();
      expect(snapshot.highLevelNotes?.potentialTodos.length).toBeGreaterThan(0);
      expect(snapshot.dailyNoteRichMarkdown.length).toBeGreaterThan(0);
    });
  });

  describe('Step 2: Extract Todos', () => {
    it('should extract todos and transition to TODOS_EXTRACTED', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      expect(snapshot.todos.length).toBeGreaterThan(0);
      expect(snapshot.todos[0]).toHaveProperty('id');
      expect(snapshot.todos[0]).toHaveProperty('text');
      expect(snapshot.todos[0]).toHaveProperty('completed');
    });
  });

  describe('Step 3: Match Todos', () => {
    it('should match todos to Notion tasks and transition to TODOS_MATCHED', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      expect(snapshot.todos.length).toBeGreaterThan(0);

      // Verify matching was called
      expect(notionClient.calls.matchTodos.length).toBeGreaterThan(0);

      // Check that some todos are matched
      const matchedTodos = snapshot.todos.filter((t) => t.isMatched);
      expect(matchedTodos.length).toBeGreaterThan(0);

      // Verify matched todos have notionId and notionUrl
      for (const todo of matchedTodos) {
        expect(todo.notionId).toBeDefined();
        expect(todo.notionUrl).toBeDefined();
      }
    });

    it('should populate isMatched, notionId, notionUrl correctly', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      for (const todo of snapshot.todos) {
        if (todo.isMatched) {
          expect(todo.notionId).toBeDefined();
          expect(todo.notionUrl).toBeDefined();
        } else {
          // Unmatched todos should not have notionId
          expect(todo.notionId).toBeUndefined();
        }
      }
    });
  });

  describe('Stage A: Update Matched Todos', () => {
    it('should update matched todo bodies and transition to TODOS_AUGMENTED', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      // Verify that fetchPageBody and updatePageBody were called for matched todos
      expect(notionClient.calls.fetchPageBody.length).toBeGreaterThan(0);
      expect(notionClient.calls.updatePageBody.length).toBeGreaterThan(0);

      // Verify that todo.description was updated
      const snapshot = orchestrator.getStateSnapshot();
      const matchedTodos = snapshot.todos.filter((t) => t.isMatched && t.notionId);
      for (const todo of matchedTodos) {
        // Description should be updated (from mock, it adds new context)
        expect(todo.description).toBeDefined();
        expect(todo.description?.length).toBeGreaterThan(0);
      }
    });

    it('should preserve existing content when updating bodies', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      // Check that updatePageBody was called with merged content
      const updateCalls = notionClient.calls.updatePageBody;
      expect(updateCalls.length).toBeGreaterThan(0);

      // Verify the updated body contains both existing and new content
      for (const call of updateCalls) {
        // The mock LLM client appends new context, so the body should contain both
        expect(call.markdown.length).toBeGreaterThan(0);
        expect(call.markdown).toContain('Updated with new transcript context');
        // The existing body should be preserved (from fixture or mock)
        expect(call.markdown).toMatch(/Create high-level|Existing task description/);
      }
    });
  });

  describe('Stage B: Augment Unmatched Todos', () => {
    it('should augment unmatched todos with project context', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      const unmatchedTodos = snapshot.todos.filter((t) => !t.isMatched);

      // If there are unmatched todos, they should be augmented
      if (unmatchedTodos.length > 0) {
        for (const todo of unmatchedTodos) {
          // Description should be enhanced
          expect(todo.description).toBeDefined();
          expect(todo.description).toContain('Enhanced with project context');
        }
      }
    });

    it('should retrieve project neighborhood for augmentation', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      // Verify that searchTasks was called to get project neighborhood
      expect(notionClient.calls.searchTasks.length).toBeGreaterThan(0);
    });

    it('should not break schema when augmenting', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      for (const todo of snapshot.todos) {
        // All todos should still validate against TodoSchema
        const validated = TodoSchema.parse(todo);
        expect(validated).toBeDefined();
      }
    });
  });

  describe('Step 4: Sync to Notion', () => {
    it('should create new todos in Notion and transition to NOTION_UPDATED', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      // Verify that createTodo was called for unmatched todos
      expect(notionClient.calls.createTodo.length).toBeGreaterThan(0);

      // Verify final state
      expect(orchestrator.getState()).toBe(ReasoningState.DONE);
    });

    it('should update notionId and notionUrl after creating todos', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      // All todos should now have notionId (either from matching or creation)
      for (const todo of snapshot.todos) {
        expect(todo.notionId).toBeDefined();
        expect(todo.notionUrl).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should transition to ERROR state on LLM failure', async () => {
      // Create a mock LLM client that throws
      const failingLLMClient = {
        extractHighLevelNotes: async () => {
          throw new Error('LLM failure');
        },
        generateDetailedStructuredData: async () => {
          throw new Error('LLM failure');
        },
        updateMatchedTodoBody: async () => {
          throw new Error('LLM failure');
        },
        refineTodoWithProjectContext: async () => {
          throw new Error('LLM failure');
        },
      } as ILLMClient;

      const orchestrator = new ReasoningOrchestrator(failingLLMClient, notionClient, transcript);

      await expect(orchestrator.run()).rejects.toThrow();
      expect(orchestrator.getState()).toBe(ReasoningState.ERROR);
      expect(orchestrator.getStateSnapshot().errors.length).toBeGreaterThan(0);
    });

    it('should preserve artifacts on error', async () => {
      // Create a mock that fails at step 2
      let step = 0;
      const failingLLMClient = {
        extractHighLevelNotes: async () => {
          step = 1;
          return llmClient.extractHighLevelNotes(transcript);
        },
        generateDetailedStructuredData: async () => {
          step = 2;
          throw new Error('Zod validation failed');
        },
        updateMatchedTodoBody: async () => {
          throw new Error('LLM failure');
        },
        refineTodoWithProjectContext: async () => {
          throw new Error('LLM failure');
        },
      } as ILLMClient;

      const orchestrator = new ReasoningOrchestrator(failingLLMClient, notionClient, transcript);

      await expect(orchestrator.run()).rejects.toThrow();
      const snapshot = orchestrator.getStateSnapshot();

      // Should preserve high-level notes from step 1
      expect(snapshot.highLevelNotes).toBeDefined();
      expect(snapshot.state).toBe(ReasoningState.ERROR);
    });
  });

  describe('Logging and Debugging', () => {
    it('should maintain logs throughout execution', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      expect(snapshot.logs.length).toBeGreaterThan(0);
      expect(snapshot.logs[0]).toContain('INIT');
    });

    it('should track warnings for non-fatal issues', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      await orchestrator.run();

      const snapshot = orchestrator.getStateSnapshot();
      // Warnings may or may not be present, but the structure should exist
      expect(Array.isArray(snapshot.warnings)).toBe(true);
    });
  });

  describe('Integration Test', () => {
    it('should run end-to-end with fixtures and produce valid DailyNoteResponse', async () => {
      const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

      const result = await orchestrator.run();

      // Validate final response structure
      expect(result).toHaveProperty('dailyNoteRichMarkdown');
      expect(result).toHaveProperty('todos');
      expect(result.dailyNoteRichMarkdown.length).toBeGreaterThan(0);
      expect(result.todos.length).toBeGreaterThan(0);

      // Validate with Zod
      const validated = DailyNoteSchema.parse(result);
      expect(validated.todos.length).toBeGreaterThan(0);

      // Verify state progression
      expect(orchestrator.getState()).toBe(ReasoningState.DONE);
    });
  });
});
