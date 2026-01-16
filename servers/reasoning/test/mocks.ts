/**
 * Mock implementations for testing
 *
 * Provides deterministic mock clients that return fixture data,
 * enabling fast, reliable tests without real LLM or Notion calls.
 */

import { ILLMClient, INotionClient } from '../src/orchestrator.js';
import {
  HighLevelNotes,
  DailyNoteResponse,
  Todo,
  NotionContextResponse,
} from '@flwst/types/src/api/reasoning';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load a JSON fixture file
 */
function loadFixture<T>(filename: string): T {
  const filePath = path.join(__dirname, 'fixtures', filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Mock LLM Client
 *
 * Returns pre-recorded "golden" outputs from fixtures instead of calling Llama.
 */
export class MockLLMClient implements ILLMClient {
  private highLevelNotesFixture: HighLevelNotes;
  private todosFixture: DailyNoteResponse;

  constructor() {
    this.highLevelNotesFixture = loadFixture<HighLevelNotes>('high-level-notes.json');
    this.todosFixture = loadFixture<DailyNoteResponse>('todos.json');
  }

  async extractHighLevelNotes(
    transcript: string,
    notionContext?: NotionContextResponse,
  ): Promise<HighLevelNotes> {
    // Return fixture data
    return this.highLevelNotesFixture;
  }

  async generateDetailedStructuredData(
    transcript: string,
    highLevelNotes: HighLevelNotes,
    notionContext?: NotionContextResponse,
  ): Promise<DailyNoteResponse> {
    // Merge high-level notes markdown with todos
    return {
      dailyNoteRichMarkdown: highLevelNotes.dailyNoteRichMarkdown,
      todos: this.todosFixture.todos,
    };
  }

  async updateMatchedTodoBody(
    todo: Todo,
    existingBody: string,
    transcript: string,
    dailyNoteMarkdown: string,
  ): Promise<string> {
    // Simulate merging: append new context to existing body
    return `${existingBody}\n\n---\n\n*Updated with new transcript context*\n\n${transcript.substring(0, 200)}...`;
  }

  async refineTodoWithProjectContext(
    todo: Todo,
    projectNeighborhood: {
      existingTasks: Array<{ title: string; body?: string }>;
      otherTodosInRun: Todo[];
    },
    transcript: string,
    dailyNoteMarkdown: string,
  ): Promise<Todo> {
    // Simulate refinement: enhance description
    return {
      ...todo,
      description: `${todo.description || ''}\n\n*Enhanced with project context*\nRelated tasks: ${projectNeighborhood.existingTasks.map((t) => t.title).join(', ')}`,
    };
  }
}

/**
 * Mock Notion Client
 *
 * Returns fixture data and tracks calls for assertions.
 */
export class MockNotionClient implements INotionClient {
  public calls: {
    searchTasks: Array<{ query: string; project?: string }>;
    matchTodos: Array<{ todos: Todo[]; tasks: any[] }>;
    fetchPageBody: string[];
    updatePageBody: Array<{ pageId: string; markdown: string }>;
    createTodo: Array<{ todo: Todo; dailyNoteId?: string }>;
  } = {
    searchTasks: [],
    matchTodos: [],
    fetchPageBody: [],
    updatePageBody: [],
    createTodo: [],
  };

  private notionTasksFixture: any[];
  private notionContextFixture: NotionContextResponse;

  constructor() {
    this.notionTasksFixture = loadFixture<any[]>('notion-tasks.json');
    this.notionContextFixture = {
      seed: 'test',
      sampledCount: 2,
      projects: ['Sherpa Health', 'Flow State', 'Personal'],
      examples: [
        {
          project: 'Sherpa Health',
          titles: ['Sherpa architecture diagrams'],
        },
        {
          project: 'Flow State',
          titles: ['Flow state demo video'],
        },
      ],
      stats: {
        total: 2,
        todo: 1,
        inProgress: 1,
        done: 0,
      },
    };
  }

  async fetchContext(): Promise<NotionContextResponse> {
    return this.notionContextFixture;
  }

  async searchTasks(query: string, project?: string): Promise<any[]> {
    this.calls.searchTasks.push({ query, project });

    // Return matching tasks from fixture
    if (!query || query.trim().length === 0) {
      return project
        ? this.notionTasksFixture.filter((t) => {
            const props = t.properties;
            const taskProject = props?.Project?.select?.name || props?.Project;
            return taskProject === project;
          })
        : this.notionTasksFixture;
    }

    // Simple keyword matching
    const queryLower = query.toLowerCase();
    return this.notionTasksFixture.filter((task) => {
      const name = task.properties?.Name?.title?.[0]?.plain_text || '';
      return name.toLowerCase().includes(queryLower);
    });
  }

  async matchTodosToNotionTasks(
    todos: Todo[],
    notionTasks: any[],
  ): Promise<{ todos: Todo[]; unmatchedCancels: string[] }> {
    this.calls.matchTodos.push({ todos, tasks: notionTasks });

    const unmatchedCancels: string[] = [];

    // Simple matching: check if todo text matches task name
    const enrichedTodos = todos.map((todo) => {
      // Detect cancel intent
      const normalizedText = todo.text.toLowerCase().trim();
      const cancelKeywords = ['cancel', 'cancelled', 'canceling', 'cancellation'];
      const isCancel =
        cancelKeywords.some((keyword) => normalizedText.startsWith(keyword)) ||
        todo.status === 'Cancelled';

      const match = notionTasks.find((task) => {
        const taskName = task.properties?.Name?.title?.[0]?.plain_text || '';
        const taskNameLower = taskName.toLowerCase();
        // For cancel intents, try matching without cancel prefix
        const textForMatching = isCancel
          ? normalizedText.replace(
              /^(cancel|cancelled|canceling|cancellation)\s+(post\s+for\s+)?/i,
              '',
            )
          : normalizedText;
        return taskNameLower.includes(textForMatching) || textForMatching.includes(taskNameLower);
      });

      if (match) {
        const enriched = {
          ...todo,
          isMatched: true,
          notionId: match.id,
          notionUrl: match.url,
          status: isCancel ? 'Cancelled' : match.properties?.Status?.status?.name || todo.status,
          priority: match.properties?.Priority?.select?.name || todo.priority,
          description:
            match.properties?.Description?.rich_text?.[0]?.plain_text || todo.description,
        };
        return enriched;
      }

      // Track unmatched cancel intents
      if (isCancel) {
        unmatchedCancels.push(todo.text);
      }

      return {
        ...todo,
        isMatched: false,
      };
    });

    return { todos: enrichedTodos, unmatchedCancels };
  }

  async fetchPageBody(pageId: string): Promise<string> {
    this.calls.fetchPageBody.push(pageId);

    // Return fixture body - use a consistent string for testing
    const task = this.notionTasksFixture.find((t) => t.id === pageId);
    if (task) {
      const existing = task.properties?.Description?.rich_text?.[0]?.plain_text;
      return existing || 'Existing task description';
    }
    return 'Existing task description';
  }

  async updatePageBody(pageId: string, markdown: string): Promise<void> {
    this.calls.updatePageBody.push({ pageId, markdown });
    // Mock: no-op, just track the call
  }

  async createTodo(todo: Todo, dailyNoteId?: string): Promise<{ id: string; url: string }> {
    this.calls.createTodo.push({ todo, dailyNoteId });
    // Return mock ID
    return {
      id: `new-task-${Date.now()}`,
      url: `https://notion.so/new-task-${Date.now()}`,
    };
  }
}
