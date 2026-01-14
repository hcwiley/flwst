/**
 * App store unit tests.
 *
 * Validates core session transitions and submit behaviors.
 */
import { describe, expect, it, vi } from 'vitest';
import { ProcessTranscriptResponseSchema } from '@flwst/types/src/api/reasoning';
import { createAppStore } from '../src/store/appStore.js';

const buildMockApi = () => {
  const processResponse = ProcessTranscriptResponseSchema.parse({
    dailyNoteDraft: {
      localId: 'daily-session-1',
      sessionId: 'session-1',
      dailyNoteRichMarkdown: '# Daily',
    },
    todoDrafts: [
      {
        id: 'todo-1',
        text: 'Task A',
        completed: false,
        localId: 'todo-1',
        sessionId: 'session-1',
        matchState: 'new',
      },
      {
        id: 'todo-2',
        text: 'Task B',
        completed: false,
        localId: 'todo-2',
        sessionId: 'session-1',
        matchState: 'ambiguous',
      },
    ],
  });

  return {
    bootstrapMirror: vi.fn().mockResolvedValue({
      projects: [],
      statuses: [],
      kanbanItems: [],
      lastSyncTime: '2025-01-01T00:00:00.000Z',
    }),
    notionStatus: vi.fn().mockResolvedValue({ connected: true }),
    notionConnect: vi.fn().mockResolvedValue({ connected: true }),
    refreshKanban: vi.fn().mockResolvedValue({
      kanbanItems: [],
      lastSyncTime: '2025-01-01T00:00:00.000Z',
    }),
    processTranscript: vi.fn().mockResolvedValue(processResponse),
    submitSession: vi.fn().mockResolvedValue({
      dailyNoteResult: { localId: 'daily-session-1', status: 'success', notionPageId: 'n1' },
      todoResults: [
        { localId: 'todo-1', status: 'success', notionPageId: 't1' },
        { localId: 'todo-2', status: 'error', errorMessage: 'Skipped' },
      ],
    }),
    submitOne: vi.fn().mockResolvedValue({
      result: { localId: 'todo-1', status: 'success', notionPageId: 't1' },
    }),
  };
};

describe('appStore', () => {
  it('ingests transcripts and populates drafts', async () => {
    const api = buildMockApi();
    const store = createAppStore(api as any);

    await store.getState().ingestTranscript('Transcript text');

    const state = store.getState();
    expect(state.session.draftDailyNote?.dailyNoteRichMarkdown).toBe('# Daily');
    expect(state.session.draftTodos.length).toBe(2);
    expect(state.session.draftTodos[1]?.includeInSubmit).toBe(false);
  });

  it('updates a single draft todo', () => {
    const api = buildMockApi();
    const store = createAppStore(api as any);

    store.setState((state) => ({
      session: {
        ...state.session,
        draftTodos: [
          {
            id: 'todo-1',
            text: 'Task A',
            completed: false,
            localId: 'todo-1',
            sessionId: 'session-1',
            matchState: 'new',
            includeInSubmit: true,
            submitState: 'idle',
          },
        ],
      },
    }));

    store.getState().updateDraftTodo('todo-1', { status: 'TODO' });
    expect(store.getState().session.draftTodos[0]?.status).toBe('TODO');
  });

  it('submits one draft and updates submit state', async () => {
    const api = buildMockApi();
    const store = createAppStore(api as any);

    store.setState((state) => ({
      session: {
        ...state.session,
        draftTodos: [
          {
            id: 'todo-1',
            text: 'Task A',
            completed: false,
            localId: 'todo-1',
            sessionId: 'session-1',
            matchState: 'new',
            includeInSubmit: true,
            submitState: 'idle',
          },
        ],
      },
    }));

    const result = await store.getState().submitOne('todo-1');
    expect(result?.status).toBe('success');
    expect(store.getState().session.draftTodos[0]?.submitState).toBe('success');
  });

  it('marks included todos as pending during submitAll', async () => {
    const api = buildMockApi();
    const store = createAppStore(api as any);

    store.setState((state) => ({
      session: {
        ...state.session,
        draftDailyNote: {
          localId: 'daily-session-1',
          sessionId: 'session-1',
          dailyNoteRichMarkdown: '# Daily',
          includeInSubmit: true,
          submitState: 'idle',
        },
        draftTodos: [
          {
            id: 'todo-1',
            text: 'Task A',
            completed: false,
            localId: 'todo-1',
            sessionId: 'session-1',
            matchState: 'new',
            includeInSubmit: true,
            submitState: 'idle',
          },
          {
            id: 'todo-2',
            text: 'Task B',
            completed: false,
            localId: 'todo-2',
            sessionId: 'session-1',
            matchState: 'ambiguous',
            includeInSubmit: false,
            submitState: 'idle',
          },
        ],
      },
    }));

    await store.getState().submitAll();
    const updated = store.getState().session.draftTodos;
    expect(updated[0]?.submitState).toBe('success');
    expect(updated[1]?.submitState).toBe('idle');
  });
});
