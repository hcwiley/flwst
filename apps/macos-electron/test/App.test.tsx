/**
 * App UI wiring tests.
 *
 * Validates core session interactions are connected to store actions.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from '../src/Provider';
import App from '../src/App';

const submitOne = vi.fn();
const submitAll = vi.fn();
const bootstrap = vi.fn();
const refreshKanban = vi.fn();
const checkNotionStatus = vi.fn().mockResolvedValue(true);
const connectNotion = vi.fn().mockResolvedValue(true);

vi.mock('../src/store/appStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      notionMirror: {
        projects: [{ id: 'p1', name: 'Project Alpha' }],
        statuses: [{ id: 's1', name: 'TODO' }],
        kanbanItems: [],
        filters: {},
        connected: true,
      },
      session: {
        sessionId: 'session-1',
        draftDailyNote: {
          localId: 'daily-1',
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
        ],
        processingPhase: 'done',
      },
      bootstrap,
      checkNotionStatus,
      connectNotion,
      refreshKanban,
      ingestTranscript: vi.fn(),
      updateDraftTodo: vi.fn(),
      updateDailyNote: vi.fn(),
      submitAll,
      submitOne,
      clearSessionError: vi.fn(),
      clearSessionWarning: vi.fn(),
    }),
}));

describe('App', () => {
  it('renders draft todos and triggers submit actions', async () => {
    render(
      <Provider>
        <App />
      </Provider>,
    );

    expect(screen.getByText('Task A')).toBeTruthy();

    await userEvent.click(screen.getByText('Submit All'));
    expect(submitAll).toHaveBeenCalled();

    await userEvent.click(screen.getByText('Sync'));
    expect(submitOne).toHaveBeenCalledWith('todo-1');
  });
});
