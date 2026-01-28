/**
 * Notion module constants and shared types.
 */

export const FLOW_STATE_PAGE_TITLE = 'flwst';
export const DAILY_NOTES_DB_TITLE = 'Daily Notes';
export const TASKS_DB_TITLE = 'To-Dos';

export type CreateResourcesResult = {
  flowStatePageId: string;
  dailyNotesDataSourceId: string;
  tasksDataSourceId: string;
};
