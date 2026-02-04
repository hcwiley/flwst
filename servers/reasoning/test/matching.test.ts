/**
 * Matching tests.
 *
 * Ensures transcript-derived fields are not overwritten by Notion data
 * when a match is found.
 */
import { describe, expect, it } from 'vitest';
import { matchTodosToNotionTasks } from '../src/matching.js';
import { notionConfig } from '../../../config/notion.js';

describe('matchTodosToNotionTasks', () => {
  it('keeps transcript status and priority on match', async () => {
    const todo = {
      id: 'todo-1',
      text: 'Run flwst locally with a Llama3 backend',
      completed: false,
      status: 'Done',
      priority: 'High',
      project: 'flwst',
    };

    const notionTask = {
      id: 'page-1',
      parent: {
        type: 'database_id',
        database_id: notionConfig.databases.tasks.id,
      },
      properties: {
        Name: {
          title: [{ plain_text: 'Run flwst locally with Llama3 backend' }],
        },
        Project: {
          select: { name: 'flwst' },
        },
        Status: {
          status: { name: 'In Progress' },
        },
        Priority: {
          select: { name: 'Low' },
        },
      },
    };

    const { todos } = await matchTodosToNotionTasks([todo], [notionTask]);
    const [result] = todos;

    expect(result?.isMatched).toBe(true);
    expect(result?.status).toBe('Done');
    expect(result?.priority).toBe('High');
  });

  it('matches cancel intent to existing task and sets status to Cancelled', async () => {
    const todo = {
      id: 'todo-1',
      text: 'Cancel Instagram post for Crescent Wrench Studio',
      completed: false,
      project: 'CWS',
    };

    const notionTask = {
      id: 'page-1',
      parent: {
        type: 'database_id',
        database_id: notionConfig.databases.tasks.id,
      },
      properties: {
        Name: {
          title: [{ plain_text: 'Instagram Post | Crescent Wrench Studio (2025-11-22)' }],
        },
        Project: {
          select: { name: 'CWS' },
        },
        Status: {
          status: { name: 'In Progress' },
        },
      },
    };

    const { todos } = await matchTodosToNotionTasks([todo], [notionTask]);
    const [result] = todos;

    expect(result?.isMatched).toBe(true);
    expect(result?.status).toBe('Cancelled');
    expect(result?.notionId).toBe('page-1');
  });

  it('tracks unmatched cancel intents', async () => {
    const todo = {
      id: 'todo-1',
      text: 'Cancel post for November 22nd',
      completed: false,
      project: 'CWS',
    };

    const notionTask = {
      id: 'page-1',
      parent: {
        type: 'database_id',
        database_id: notionConfig.databases.tasks.id,
      },
      properties: {
        Name: {
          title: [{ plain_text: 'Different Task Name' }],
        },
        Project: {
          select: { name: 'CWS' },
        },
      },
    };

    const { todos, unmatchedCancels } = await matchTodosToNotionTasks([todo], [notionTask]);
    const [result] = todos;

    expect(result?.isMatched).toBe(false);
    expect(unmatchedCancels).toContain('Cancel post for November 22nd');
  });

  it('normalizes cancel text for matching', async () => {
    const todo = {
      id: 'todo-1',
      text: 'Cancel post for November 22nd',
      completed: false,
      project: 'CWS',
    };

    const notionTask = {
      id: 'page-1',
      parent: {
        type: 'database_id',
        database_id: notionConfig.databases.tasks.id,
      },
      properties: {
        Name: {
          title: [{ plain_text: 'Post for November 22nd' }],
        },
        Project: {
          select: { name: 'CWS' },
        },
      },
    };

    const { todos } = await matchTodosToNotionTasks([todo], [notionTask]);
    const [result] = todos;

    expect(result?.isMatched).toBe(true);
    expect(result?.status).toBe('Cancelled');
  });

  it('matches cancel intent with normalized date to task containing that date', async () => {
    // Simulate a cancel intent where the date was normalized from "November 17th" to ISO format
    // This tests that date normalization in extraction enables proper matching
    const todo = {
      id: 'todo-1',
      text: 'Cancel Instagram post for Example Project',
      completed: false,
      project: 'Example Project',
      dueDate: '2025-11-17', // Normalized from "November 17th" in transcript
    };

    const notionTask = {
      id: 'page-1',
      parent: {
        type: 'database_id',
        database_id: notionConfig.databases.tasks.id,
      },
      properties: {
        Name: {
          title: [{ plain_text: 'Instagram Post | Example Project (2025-11-17)' }],
        },
        Project: {
          select: { name: 'Example Project' },
        },
        Status: {
          status: { name: 'In Progress' },
        },
      },
    };

    const { todos } = await matchTodosToNotionTasks([todo], [notionTask]);
    const [result] = todos;

    expect(result?.isMatched).toBe(true);
    expect(result?.status).toBe('Cancelled');
    expect(result?.notionId).toBe('page-1');
    // Verify the normalized dueDate is preserved
    expect(result?.dueDate).toBe('2025-11-17');
  });

  it('preserves normalized dueDate when matching cancel intent', async () => {
    // Test that normalized dates are preserved in the todo after matching
    // This verifies that date normalization in extraction enables proper date tracking
    const todo = {
      id: 'todo-1',
      text: 'Cancel Instagram post for November 17th for Example Project',
      completed: false,
      project: 'Example Project',
      dueDate: '2025-11-17', // Normalized from "November 17th" in transcript
    };

    const notionTask = {
      id: 'page-1',
      parent: {
        type: 'database_id',
        database_id: notionConfig.databases.tasks.id,
      },
      properties: {
        Name: {
          title: [{ plain_text: 'Instagram Post | Example Project (2025-11-17)' }],
        },
        Project: {
          select: { name: 'Example Project' },
        },
        'Due Date': {
          date: { start: '2025-11-17' },
        },
      },
    };

    const { todos: matchedTodos } = await matchTodosToNotionTasks([todo], [notionTask]);
    const [result] = matchedTodos;

    expect(result?.isMatched).toBe(true);
    expect(result?.status).toBe('Cancelled');
    expect(result?.notionId).toBe('page-1');
    // Verify the normalized dueDate from transcript is preserved (not overwritten by Notion)
    expect(result?.dueDate).toBe('2025-11-17');
  });
});
