/**
 * Renderer Zustand store for session and Notion mirror state.
 *
 * Owns the full session lifecycle and provides typed actions that
 * call into the IPC-backed app API.
 */
import { create } from 'zustand';
import type {
  DailyNoteDraft,
  MatchSuggestion,
  ProcessTranscriptJobPhase,
  ProcessTranscriptJobStatus,
  ProcessTranscriptResponse,
  SubmitResult,
  TodoDraft,
} from '@flwst/types/src/api/reasoning';
import { appApi, type AppApi } from '../appApi';
import type { AppActions, AppState, NotionMirrorFilters, SessionSubmitResult } from './types';

type StoreState = AppState & AppActions;
type SetState = (
  partial:
    | StoreState
    | Partial<StoreState>
    | ((state: StoreState) => StoreState | Partial<StoreState>),
  replace?: boolean,
) => void;

const initialState: AppState = {
  notionMirror: {
    projects: [],
    statuses: [],
    kanbanItems: [],
    filters: {},
  },
  session: {
    draftTodos: [],
    processingPhase: 'idle',
  },
};

export const createAppStore = (api: AppApi = appApi) =>
  create<AppState & AppActions>((set, get) => ({
    ...initialState,
    bootstrap: async () => {
      const connected = await api.notionStatus();
      set((state) => ({
        notionMirror: {
          ...state.notionMirror,
          connected: connected.connected,
        },
      }));
      if (!connected.connected) return;

      const response = await api.bootstrapMirror();
      set((state) => ({
        notionMirror: {
          ...state.notionMirror,
          projects: response.projects,
          statuses: response.statuses,
          kanbanItems: response.kanbanItems,
          lastSyncTime: response.lastSyncTime,
        },
      }));
    },
    checkNotionStatus: async () => {
      const response = await api.notionStatus();
      set((state) => ({
        notionMirror: {
          ...state.notionMirror,
          connected: response.connected,
        },
      }));
      return response.connected;
    },
    connectNotion: async () => {
      const response = await api.notionConnect();
      set((state) => ({
        notionMirror: {
          ...state.notionMirror,
          connected: response.connected,
        },
      }));
      if (response.connected) {
        const mirror = await api.bootstrapMirror();
        set((state) => ({
          notionMirror: {
            ...state.notionMirror,
            projects: mirror.projects,
            statuses: mirror.statuses,
            kanbanItems: mirror.kanbanItems,
            lastSyncTime: mirror.lastSyncTime,
          },
        }));
      }
      return response.connected;
    },
    refreshKanban: async (filters?: NotionMirrorFilters) => {
      const response = await api.refreshKanban({ filters });
      set((state) => ({
        notionMirror: {
          ...state.notionMirror,
          filters: filters ?? state.notionMirror.filters,
          kanbanItems: response.kanbanItems,
          lastSyncTime: response.lastSyncTime,
        },
      }));
    },
    ingestTranscript: async (transcript: string, context?: unknown) => {
      const sessionId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const transcriptHash = await computeTranscriptHash(transcript);

      set((state) => ({
        session: {
          ...state.session,
          sessionId,
          inputMetadata: { createdAt, transcriptHash },
          draftDailyNote: undefined,
          draftTodos: [],
          error: undefined,
          warning: undefined,
          processingPhase: 'fetching',
        },
      }));

      try {
        const response = await api.processTranscript(
          {
            transcript,
            sessionId,
            context,
          },
          {
            onProgress: (progress) => {
              set((state) => ({
                session: {
                  ...state.session,
                  processingPhase: mapJobProgressToPhase(progress),
                },
              }));
            },
          },
        );
        const normalized = applyMatchDefaults(response);

        set((state) => ({
          session: {
            ...state.session,
            draftDailyNote: normalized.dailyNoteDraft,
            draftTodos: normalized.todoDrafts,
            processingPhase: 'done',
          },
        }));
      } catch (error) {
        set((state) => ({
          session: {
            ...state.session,
            processingPhase: 'error',
            error: error instanceof Error ? error.message : 'Failed to process transcript',
          },
        }));
      }
    },
    updateDraftTodo: (localId: string, patch: Partial<TodoDraft>) => {
      set((state) => ({
        session: {
          ...state.session,
          draftTodos: state.session.draftTodos.map((todo) =>
            todo.localId === localId ? { ...todo, ...patch } : todo,
          ),
        },
      }));
    },
    updateDailyNote: (patch: Partial<DailyNoteDraft>) => {
      set((state) => ({
        session: {
          ...state.session,
          draftDailyNote: state.session.draftDailyNote
            ? { ...state.session.draftDailyNote, ...patch }
            : state.session.draftDailyNote,
        },
      }));
    },
    submitAll: async () => {
      const { session } = get();
      if (!session.draftDailyNote) return undefined;

      set((state) => ({
        session: {
          ...state.session,
          processingPhase: 'submitting',
          draftDailyNote: {
            ...state.session.draftDailyNote!,
            submitState: 'pending',
            error: undefined,
          },
          draftTodos: state.session.draftTodos.map((todo) => ({
            ...todo,
            submitState: todo.includeInSubmit ? 'pending' : todo.submitState,
            error: undefined,
          })),
        },
      }));

      try {
        const response = await api.submitSession({
          dailyNoteDraft: session.draftDailyNote,
          todoDrafts: session.draftTodos.filter((todo) => todo.includeInSubmit),
        });

        applySubmitResults(response, set);
        return response;
      } catch (error) {
        set((state) => ({
          session: {
            ...state.session,
            processingPhase: 'error',
            error: error instanceof Error ? error.message : 'Failed to submit session',
          },
        }));
        return undefined;
      }
    },
    submitOne: async (localId: string) => {
      const { session } = get();
      const target = session.draftTodos.find((todo) => todo.localId === localId);
      if (!target) return undefined;

      set((state) => ({
        session: {
          ...state.session,
          draftTodos: state.session.draftTodos.map((todo) =>
            todo.localId === localId ? { ...todo, submitState: 'pending', error: undefined } : todo,
          ),
        },
      }));

      try {
        const response = await api.submitOne({ draft: target });
        applySubmitResults(
          {
            dailyNoteResult: undefined,
            todoResults: [response.result],
          },
          set,
        );
        return response.result;
      } catch (error) {
        set((state) => ({
          session: {
            ...state.session,
            draftTodos: state.session.draftTodos.map((todo) =>
              todo.localId === localId
                ? {
                    ...todo,
                    submitState: 'error',
                    error: error instanceof Error ? error.message : 'Failed to submit todo',
                  }
                : todo,
            ),
          },
        }));
        return undefined;
      }
    },
    clearSessionError: () => {
      set((state) => ({
        session: {
          ...state.session,
          error: undefined,
          processingPhase:
            state.session.processingPhase === 'error' ? 'idle' : state.session.processingPhase,
        },
      }));
    },
    clearSessionWarning: () => {
      set((state) => ({
        session: {
          ...state.session,
          warning: undefined,
        },
      }));
    },
  }));

export const useAppStore = createAppStore();

function applyMatchDefaults(response: ProcessTranscriptResponse): ProcessTranscriptResponse {
  const suggestionsById = new Map(
    response.matchSuggestions?.map((suggestion) => [suggestion.localId, suggestion]) ?? [],
  );

  return {
    ...response,
    todoDrafts: response.todoDrafts.map((todo) => {
      const suggestion = suggestionsById.get(todo.localId);
      if (!suggestion) {
        return {
          ...todo,
          includeInSubmit: todo.matchState !== 'ambiguous',
        };
      }

      return {
        ...todo,
        matchState: suggestion.matchState,
        notionTargetId: suggestion.notionTargetId ?? todo.notionTargetId,
        includeInSubmit: suggestion.matchState !== 'ambiguous',
      };
    }),
  };
}

type JobProgress = {
  status: ProcessTranscriptJobStatus;
  phase?: ProcessTranscriptJobPhase;
};

function mapJobProgressToPhase(progress: JobProgress): AppState['session']['processingPhase'] {
  if (progress.phase) {
    if (progress.phase === 'done') return 'done';
    if (progress.phase === 'error') return 'error';
    return progress.phase;
  }

  switch (progress.status) {
    case 'queued':
      return 'fetching';
    case 'running':
      return 'reasoning';
    case 'succeeded':
      return 'done';
    case 'failed':
      return 'error';
    default:
      return 'reasoning';
  }
}

function applySubmitResults(results: SessionSubmitResult, setState: SetState) {
  const { dailyNoteResult, todoResults } = results;
  const todoResultsById = new Map(todoResults.map((result) => [result.localId, result]));

  setState((state) => ({
    session: {
      ...state.session,
      processingPhase: 'done',
      draftDailyNote: dailyNoteResult
        ? mergeSubmitResult(state.session.draftDailyNote, dailyNoteResult)
        : state.session.draftDailyNote,
      draftTodos: state.session.draftTodos.map((todo) => {
        const result = todoResultsById.get(todo.localId);
        return result ? mergeSubmitResult(todo, result) : todo;
      }),
    },
  }));
}

function mergeSubmitResult<
  T extends { submitState?: string; error?: string; notionTargetId?: string; notionId?: string },
>(draft: T | undefined, result: SubmitResult): T | undefined {
  if (!draft) return draft;

  if (result.status === 'success') {
    return {
      ...draft,
      submitState: 'success',
      error: undefined,
      notionTargetId: result.notionPageId ?? draft.notionTargetId,
      notionId: result.notionPageId ?? draft.notionId,
    };
  }

  return {
    ...draft,
    submitState: 'error',
    error: result.errorMessage ?? 'Submission failed',
  };
}

async function computeTranscriptHash(transcript: string): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const encoder = new TextEncoder();
  const data = encoder.encode(transcript);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
