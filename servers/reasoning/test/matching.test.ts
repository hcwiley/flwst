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

    const [result] = await matchTodosToNotionTasks([todo], [notionTask]);

    expect(result?.isMatched).toBe(true);
    expect(result?.status).toBe('Done');
    expect(result?.priority).toBe('High');
  });
});
