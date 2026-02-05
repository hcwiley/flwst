/**
 * Zustand store scaffolding for FlowState application state.
 * Phase 1: Placeholder slices; Phase 7: notionSync slice for Notion tasks/notes.
 */

import { create } from 'zustand';
import type {
  NotionDailyNotePage,
  NotionTaskPage,
  UserConfig,
} from '@flwst/types';

/** Sync error for UI display. */
export type NotionSyncError = { message: string; at: string };

/**
 * Application store state interface.
 */
export interface AppState {
  inbox: Record<string, never>;

  config: {
    userConfig: UserConfig | null;
  };

  review: Record<string, never>;

  kanban: Record<string, never>;

  notionSync: {
    lastSyncAt?: string;
    isSyncing: boolean;
    lastError: NotionSyncError | null;
    tasksById: Record<string, NotionTaskPage>;
    notesById: Record<string, NotionDailyNotePage>;
  };
}

/**
 * Application store actions interface.
 */
export interface AppActions {
  /** Set syncing in progress and clear last error. */
  startSync: () => void;
  /** Hydrate tasks and notes, set lastSyncAt, clear syncing. */
  completeSync: (tasks: NotionTaskPage[], notes: NotionDailyNotePage[]) => void;
  /** Set error and clear syncing. */
  failSync: (error: NotionSyncError) => void;
  /** Update only tasks (e.g. after tasks-only sync). */
  syncTasksOnly: (tasks: NotionTaskPage[]) => void;
}

/**
 * Application store type.
 */
export type AppStore = AppState & AppActions;

const initialNotionSync: AppState['notionSync'] = {
  isSyncing: false,
  lastError: null,
  tasksById: {},
  notesById: {},
};

/**
 * Create the application store.
 */
export const useAppStore = create<AppStore>((set) => ({
  inbox: {},
  config: {
    userConfig: null,
  },
  review: {},
  kanban: {},
  notionSync: initialNotionSync,

  startSync: () =>
    set((state) => ({
      notionSync: {
        ...state.notionSync,
        isSyncing: true,
        lastError: null,
      },
    })),

  completeSync: (tasks, notes) => {
    const tasksById: Record<string, NotionTaskPage> = {};
    for (const t of tasks) tasksById[t.id] = t;
    const notesById: Record<string, NotionDailyNotePage> = {};
    for (const n of notes) notesById[n.id] = n;
    set((state) => ({
      notionSync: {
        ...state.notionSync,
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
        tasksById,
        notesById,
      },
    }));
  },

  failSync: (error) =>
    set((state) => ({
      notionSync: {
        ...state.notionSync,
        isSyncing: false,
        lastError: error,
      },
    })),

  syncTasksOnly: (tasks) => {
    const tasksById: Record<string, NotionTaskPage> = {};
    for (const t of tasks) tasksById[t.id] = t;
    set((state) => ({
      notionSync: {
        ...state.notionSync,
        tasksById,
        isSyncing: false,
      },
    }));
  },
}));
