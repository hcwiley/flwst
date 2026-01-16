/**
 * Renderer store types for session and Notion mirror state.
 *
 * Keeps renderer-owned state typed and aligned with shared Zod schemas.
 */
import type {
  DailyNoteDraft,
  NotionSelectOption,
  NotionTodoCard,
  SubmitResult,
  TodoDraft,
} from '@flwst/types/src/api/reasoning';

export type ProcessingPhase =
  | 'idle'
  | 'fetching'
  | 'analyzing'
  | 'reasoning'
  | 'matching'
  | 'done'
  | 'submitting'
  | 'error';

export type NotionMirrorFilters = {
  project?: string;
  status?: string;
  dueDateRange?: { start?: string; end?: string };
  lastModifiedAfter?: string;
  createdAfter?: string;
};

export type NotionMirrorState = {
  projects: NotionSelectOption[];
  statuses: NotionSelectOption[];
  kanbanItems: NotionTodoCard[];
  filters: NotionMirrorFilters;
  lastSyncTime?: string;
  connected?: boolean;
};

export type SessionInputMetadata = {
  filename?: string;
  createdAt: string;
  transcriptHash?: string;
};

export type SessionState = {
  sessionId?: string;
  inputMetadata?: SessionInputMetadata;
  draftDailyNote?: DailyNoteDraft;
  draftTodos: TodoDraft[];
  processingPhase: ProcessingPhase;
  error?: string;
  warning?: string;
};

export type SessionSubmitResult = {
  dailyNoteResult?: SubmitResult;
  todoResults: SubmitResult[];
};

export type AppState = {
  notionMirror: NotionMirrorState;
  session: SessionState;
};

export type AppActions = {
  bootstrap: () => Promise<void>;
  checkNotionStatus: () => Promise<boolean>;
  connectNotion: () => Promise<boolean>;
  refreshKanban: (filters?: NotionMirrorFilters) => Promise<void>;
  ingestTranscript: (transcript: string, context?: unknown) => Promise<void>;
  updateDraftTodo: (localId: string, patch: Partial<TodoDraft>) => void;
  updateDailyNote: (patch: Partial<DailyNoteDraft>) => void;
  submitAll: () => Promise<SessionSubmitResult | undefined>;
  submitOne: (localId: string) => Promise<SubmitResult | undefined>;
  clearSessionError: () => void;
  clearSessionWarning: () => void;
};
