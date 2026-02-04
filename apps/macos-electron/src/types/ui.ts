/**
 * Shared UI types for the renderer components.
 *
 * Centralizes view model contracts so UI components stay lean and typed.
 */
import type {
  DailyNoteDraft,
  NotionSelectOption,
  NotionTodoCard,
} from '@flwst/types/src/api/reasoning';

/**
 * Daily note presentation mode.
 */
export type DailyNoteView = 'preview' | 'raw';

/**
 * Kanban layout density.
 */
export type KanbanLayout = 'comfortable' | 'fit';

/**
 * Filter inputs for the kanban refresh.
 */
export interface KanbanFilters {
  project: string;
  status: string;
  dueStart: string;
  dueEnd: string;
  createdAfter: string;
}

/**
 * Props for the top-level application header.
 */
export interface AppHeaderProps {
  ipcAvailable: boolean;
  isRefreshingKanban: boolean;
  notionConnected: boolean;
  onRefreshKanban: () => void;
  onConnectNotion: () => void;
}

/**
 * Props for the session drafts panel.
 */
export interface SessionDraftsProps {
  ipcAvailable: boolean;
}

/**
 * Props for the daily note panel.
 */
export interface DailyNotePanelProps {
  dailyNote: DailyNoteDraft;
  view: DailyNoteView;
  onViewChange: (view: DailyNoteView) => void;
  onUpdate: (patch: Partial<DailyNoteDraft>) => void;
  onSubmitAll: () => void;
}

/**
 * Props for the kanban section wrapper.
 */
export interface KanbanPanelProps {
  filters: KanbanFilters;
  onFiltersChange: (filters: KanbanFilters) => void;
  layout: KanbanLayout;
  onLayoutChange: (layout: KanbanLayout) => void;
  enabledStatuses: string[];
  onToggleStatus: (status: string) => void;
  isRefreshing: boolean;
}

/**
 * Props for the kanban filters and status toggles.
 */
export interface KanbanFiltersProps {
  filters: KanbanFilters;
  statusOptions: string[];
  enabledStatuses: string[];
  onFiltersChange: (filters: KanbanFilters) => void;
  onToggleStatus: (status: string) => void;
}

/**
 * Props for the kanban board display.
 */
export interface KanbanBoardProps {
  items: NotionTodoCard[];
  statuses: NotionSelectOption[];
  enabledStatuses: string[];
  layout: KanbanLayout;
  isRefreshing: boolean;
}
