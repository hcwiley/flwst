/**
 * Notion gateway submit planning tests.
 *
 * Verifies create vs update vs skip behavior for draft todos.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  DailyNoteDraftSchema,
  TodoDraftSchema,
  type TodoDraft,
} from '@flwst/types/src/api/reasoning';
import { NotionGateway } from '../electron/notion-gateway.js';

const baseDailyNoteDraft = DailyNoteDraftSchema.parse({
  localId: 'daily-1',
  sessionId: 'session-1',
  dailyNoteRichMarkdown: '# Daily Note',
});

const makeDraft = (overrides: Partial<TodoDraft> = {}): TodoDraft =>
  TodoDraftSchema.parse({
    id: 'todo-1',
    text: 'Draft todo',
    completed: false,
    localId: 'local-1',
    sessionId: 'session-1',
    matchState: 'new',
    ...overrides,
  });

const buildGateway = () => {
  const notionClient = {
    updateTodo: vi.fn().mockResolvedValue(undefined),
    createTodo: vi.fn().mockResolvedValue({ id: 'notion-1', url: 'url' }),
  };

  const notionApiClient = {
    getDatabase: vi.fn().mockResolvedValue({ properties: {} }),
    queryDatabase: vi.fn().mockResolvedValue({ results: [] }),
    createPage: vi.fn().mockResolvedValue({ id: 'daily-1' }),
  };

  const gateway = new NotionGateway({
    notionClient: notionClient as any,
    notionApiClient: notionApiClient as any,
    notionConfig: {
      databases: {
        tasks: { id: 'tasks-db' },
        dailyNotes: { id: 'daily-db' },
      },
    } as any,
    now: () => new Date('2025-01-01T00:00:00.000Z'),
  });

  return { gateway, notionClient, notionApiClient };
};

describe('NotionGateway submitSession', () => {
  it('updates matched todos', async () => {
    const { gateway, notionClient } = buildGateway();
    const matched = makeDraft({ matchState: 'matched', notionTargetId: 'notion-123' });

    const result = await gateway.submitSession({
      dailyNoteDraft: baseDailyNoteDraft,
      todoDrafts: [matched],
    });

    expect(result.todoResults[0]?.status).toBe('success');
    expect(notionClient.updateTodo).toHaveBeenCalledTimes(1);
    expect(notionClient.createTodo).not.toHaveBeenCalled();
  });

  it('creates new todos', async () => {
    const { gateway, notionClient } = buildGateway();
    const draft = makeDraft({ matchState: 'new' });

    const result = await gateway.submitSession({
      dailyNoteDraft: baseDailyNoteDraft,
      todoDrafts: [draft],
    });

    expect(result.todoResults[0]?.status).toBe('success');
    expect(notionClient.createTodo).toHaveBeenCalledTimes(1);
    expect(notionClient.updateTodo).not.toHaveBeenCalled();
  });

  it('skips ambiguous todos by default', async () => {
    const { gateway, notionClient } = buildGateway();
    const ambiguous = makeDraft({ matchState: 'ambiguous' });

    const result = await gateway.submitSession({
      dailyNoteDraft: baseDailyNoteDraft,
      todoDrafts: [ambiguous],
    });

    expect(result.todoResults[0]?.status).toBe('success');
    expect(notionClient.createTodo).not.toHaveBeenCalled();
    expect(notionClient.updateTodo).not.toHaveBeenCalled();
  });
});
