/**
 * Zustand store scaffolding for FlowState application state.
 * Phase 1: Placeholder slices only.
 */

import { create } from 'zustand';
import type { UserConfig } from '@flwst/types';

/**
 * Application store state interface.
 */
export interface AppState {
  // Placeholder for inbox slice
  inbox: {
    // Future: transcript ingestion state
  };

  // Placeholder for config slice
  config: {
    userConfig: UserConfig | null;
    // Future: config management actions
  };

  // Placeholder for review slice
  review: {
    // Future: daily note and task review state
  };

  // Placeholder for kanban slice
  kanban: {
    // Future: task board state and filters
  };
}

/**
 * Application store actions interface.
 */
export interface AppActions {
  // Placeholder for future actions
}

/**
 * Application store type.
 */
export type AppStore = AppState & AppActions;

/**
 * Create the application store.
 * Phase 1: Minimal placeholder implementation.
 */
export const useAppStore = create<AppStore>(() => ({
  inbox: {},
  config: {
    userConfig: null,
  },
  review: {},
  kanban: {},
}));
