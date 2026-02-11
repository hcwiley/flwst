/**
 * Unit tests for Notion resource creation helpers.
 */

import { strict as assert } from 'node:assert';
import { describe, it, mock } from 'node:test';
import { Client } from '@notionhq/client';
import {
  createFlowStatePage,
  createDailyNotesDatabase,
  createTasksDatabase,
  findExistingResources,
} from './resources';
import {
  FLOW_STATE_PAGE_TITLE,
  DAILY_NOTES_DB_TITLE,
  TASKS_DB_TITLE,
} from './constants';

type CreatePageParameters = Parameters<Client['pages']['create']>[0];
type CreatePageResponse = Awaited<ReturnType<Client['pages']['create']>>;
type CreateDatabaseParameters = Parameters<Client['databases']['create']>[0];
type CreateDatabaseResponse = Awaited<
  ReturnType<Client['databases']['create']>
>;

type DatabaseCreatePayload = {
  parent:
    | { type: 'page_id'; page_id: string }
    | { type: 'workspace'; workspace: true };
  title?: Array<{ type?: string; text?: { content: string } }>;
  properties?: Record<string, unknown>;
};

describe('resources helpers', () => {
  describe('createFlowStatePage', () => {
    it('creates a page with correct parent and title', async () => {
      const pagesCreate = mock.fn(
        async (_args: CreatePageParameters): Promise<CreatePageResponse> =>
          ({
            id: 'page-id-123',
          }) as CreatePageResponse,
      );
      const mockNotion = {
        pages: {
          create: pagesCreate,
        },
      } as unknown as Client;

      const parentPageId = 'parent-page-id-456';
      const result = await createFlowStatePage(mockNotion, parentPageId);

      assert.equal(result, 'page-id-123');
      assert.equal(pagesCreate.mock.calls.length, 1);
      const call = pagesCreate.mock.calls[0];
      const [payload] = call.arguments;
      assert.deepEqual(payload, {
        parent: { page_id: parentPageId },
        properties: {
          title: {
            title: [{ text: { content: FLOW_STATE_PAGE_TITLE } }],
          },
        },
      });
    });

    it('handles API errors', async () => {
      const pagesCreate = mock.fn(
        async (_args: CreatePageParameters): Promise<CreatePageResponse> => {
          throw new Error('Notion API error');
        },
      );
      const mockNotion = {
        pages: {
          create: pagesCreate,
        },
      } as unknown as Client;

      await assert.rejects(
        async () => {
          await createFlowStatePage(mockNotion, 'parent-id');
        },
        {
          message: 'Notion API error',
        },
      );
    });
  });

  describe('createDailyNotesDatabase', () => {
    it('creates a database with correct parent, title, and properties', async () => {
      const databasesCreate = mock.fn(
        async (
          _args: CreateDatabaseParameters,
        ): Promise<CreateDatabaseResponse> =>
          ({
            id: 'db-id-123',
          }) as CreateDatabaseResponse,
      );
      const mockNotion = {
        databases: {
          create: databasesCreate,
        },
      } as unknown as Client;

      const flowStatePageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const result = await createDailyNotesDatabase(
        mockNotion,
        flowStatePageId,
      );

      assert.equal(result, 'db-id-123');
      assert.equal(databasesCreate.mock.calls.length, 1);
      const call = databasesCreate.mock.calls[0];
      const [payload] = call.arguments as [DatabaseCreatePayload];
      assert.equal(payload.parent.type, 'page_id');
      if (payload.parent.type !== 'page_id') {
        throw new Error('Expected page_id parent');
      }
      assert.equal(payload.parent.page_id, flowStatePageId);
      const titleItem = payload.title?.[0];
      assert.ok(titleItem?.text?.content);
      assert.equal(titleItem?.text?.content, DAILY_NOTES_DB_TITLE);
      assert.ok(payload.properties);
      assert.ok(payload.properties?.Name);
    });

    it('normalizes parent page ID', async () => {
      const databasesCreate = mock.fn(
        async (
          _args: CreateDatabaseParameters,
        ): Promise<CreateDatabaseResponse> =>
          ({
            id: 'db-id-123',
          }) as CreateDatabaseResponse,
      );
      const mockNotion = {
        databases: {
          create: databasesCreate,
        },
      } as unknown as Client;

      // Test with non-hyphenated ID
      const flowStatePageId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await createDailyNotesDatabase(mockNotion, flowStatePageId);

      const call = databasesCreate.mock.calls[0];
      const [payload] = call.arguments as [DatabaseCreatePayload];
      // Should be normalized to hyphenated form
      assert.equal(payload.parent.type, 'page_id');
      if (payload.parent.type !== 'page_id') {
        throw new Error('Expected page_id parent');
      }
      assert.equal(
        payload.parent.page_id,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      );
    });

    it('handles API errors', async () => {
      const databasesCreate = mock.fn(
        async (
          _args: CreateDatabaseParameters,
        ): Promise<CreateDatabaseResponse> => {
          throw new Error('Database creation failed');
        },
      );
      const mockNotion = {
        databases: {
          create: databasesCreate,
        },
      } as unknown as Client;

      await assert.rejects(
        async () => {
          await createDailyNotesDatabase(
            mockNotion,
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          );
        },
        {
          message: 'Database creation failed',
        },
      );
    });
  });

  describe('createTasksDatabase', () => {
    it('creates a database with correct parent, title, and properties', async () => {
      const databasesCreate = mock.fn(
        async (
          _args: CreateDatabaseParameters,
        ): Promise<CreateDatabaseResponse> =>
          ({
            id: 'tasks-db-id-123',
          }) as CreateDatabaseResponse,
      );
      const mockNotion = {
        databases: {
          create: databasesCreate,
        },
      } as unknown as Client;

      const flowStatePageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const result = await createTasksDatabase(mockNotion, flowStatePageId);

      assert.equal(result, 'tasks-db-id-123');
      assert.equal(databasesCreate.mock.calls.length, 1);
      const call = databasesCreate.mock.calls[0];
      const [payload] = call.arguments as [DatabaseCreatePayload];
      assert.equal(payload.parent.type, 'page_id');
      if (payload.parent.type !== 'page_id') {
        throw new Error('Expected page_id parent');
      }
      assert.equal(payload.parent.page_id, flowStatePageId);
      const titleItem = payload.title?.[0];
      assert.ok(titleItem?.text?.content);
      assert.equal(titleItem?.text?.content, TASKS_DB_TITLE);
      assert.ok(payload.properties);
      assert.ok(payload.properties?.Name);
      assert.ok(payload.properties?.Status);
      assert.ok(payload.properties?.Priority);
    });

    it('logs and rethrows errors', async () => {
      const databasesCreate = mock.fn(
        async (
          _args: CreateDatabaseParameters,
        ): Promise<CreateDatabaseResponse> => {
          throw new Error('Tasks database creation failed');
        },
      );
      const mockNotion = {
        databases: {
          create: databasesCreate,
        },
      } as unknown as Client;

      await assert.rejects(
        async () => {
          await createTasksDatabase(
            mockNotion,
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          );
        },
        {
          message: 'Tasks database creation failed',
        },
      );
    });
  });

  describe('findExistingResources', () => {
    const PARENT_PAGE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const FLWST_PAGE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const DAILY_NOTES_DB_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const TASKS_DB_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

    it('returns empty result when flwst page not found', async () => {
      const mockNotion = {
        search: mock.fn(async () => ({
          results: [],
        })),
      } as unknown as Client;

      const result = await findExistingResources(mockNotion, PARENT_PAGE_ID);

      assert.deepEqual(result, {});
      assert.equal(mockNotion.search.mock.calls.length, 1);
    });

    it('returns only flowStatePageId when no databases exist', async () => {
      const mockNotion = {
        search: mock.fn(async () => ({
          results: [
            {
              id: FLWST_PAGE_ID,
              parent: {
                type: 'page_id',
                page_id: PARENT_PAGE_ID,
              },
            },
          ],
        })),
        blocks: {
          children: {
            list: mock.fn(async () => ({
              results: [],
            })),
          },
        },
      } as unknown as Client;

      const result = await findExistingResources(mockNotion, PARENT_PAGE_ID);

      assert.equal(result.flowStatePageId, FLWST_PAGE_ID);
      assert.equal(result.dailyNotesDataSourceId, undefined);
      assert.equal(result.tasksDataSourceId, undefined);
    });

    it('finds both databases when they exist', async () => {
      const mockNotion = {
        search: mock.fn(async () => ({
          results: [
            {
              id: FLWST_PAGE_ID,
              parent: {
                type: 'page_id',
                page_id: PARENT_PAGE_ID,
              },
            },
          ],
        })),
        blocks: {
          children: {
            list: mock.fn(async () => ({
              results: [
                {
                  type: 'child_database',
                  id: DAILY_NOTES_DB_ID,
                  child_database: {
                    title: 'Daily Notes',
                  },
                },
                {
                  type: 'child_database',
                  id: TASKS_DB_ID,
                  child_database: {
                    title: 'To-Dos',
                  },
                },
              ],
            })),
          },
        },
        databases: {
          retrieve: mock.fn(async (params: { database_id: string }) => {
            if (params.database_id === DAILY_NOTES_DB_ID) {
              return {
                data_sources: [{ id: 'daily-notes-data-source-id' }],
              };
            }
            if (params.database_id === TASKS_DB_ID) {
              return {
                data_sources: [{ id: 'tasks-data-source-id' }],
              };
            }
            throw new Error('Unexpected database ID');
          }),
        },
      } as unknown as Client;

      const result = await findExistingResources(mockNotion, PARENT_PAGE_ID);

      assert.equal(result.flowStatePageId, FLWST_PAGE_ID);
      assert.equal(result.dailyNotesDataSourceId, 'daily-notes-data-source-id');
      assert.equal(result.tasksDataSourceId, 'tasks-data-source-id');
    });

    it('finds only Daily Notes when Tasks database is missing', async () => {
      const mockNotion = {
        search: mock.fn(async () => ({
          results: [
            {
              id: FLWST_PAGE_ID,
              parent: {
                type: 'page_id',
                page_id: PARENT_PAGE_ID,
              },
            },
          ],
        })),
        blocks: {
          children: {
            list: mock.fn(async () => ({
              results: [
                {
                  type: 'child_database',
                  id: DAILY_NOTES_DB_ID,
                  child_database: {
                    title: 'Daily Notes',
                  },
                },
              ],
            })),
          },
        },
        databases: {
          retrieve: mock.fn(async () => ({
            data_sources: [{ id: 'daily-notes-data-source-id' }],
          })),
        },
      } as unknown as Client;

      const result = await findExistingResources(mockNotion, PARENT_PAGE_ID);

      assert.equal(result.flowStatePageId, FLWST_PAGE_ID);
      assert.equal(result.dailyNotesDataSourceId, 'daily-notes-data-source-id');
      assert.equal(result.tasksDataSourceId, undefined);
    });

    it('ignores non-database blocks', async () => {
      const mockNotion = {
        search: mock.fn(async () => ({
          results: [
            {
              id: FLWST_PAGE_ID,
              parent: {
                type: 'page_id',
                page_id: PARENT_PAGE_ID,
              },
            },
          ],
        })),
        blocks: {
          children: {
            list: mock.fn(async () => ({
              results: [
                {
                  type: 'paragraph',
                  id: 'paragraph-block-id',
                },
                {
                  type: 'heading_1',
                  id: 'heading-block-id',
                },
                {
                  type: 'child_database',
                  id: DAILY_NOTES_DB_ID,
                  child_database: {
                    title: 'Daily Notes',
                  },
                },
              ],
            })),
          },
        },
        databases: {
          retrieve: mock.fn(async () => ({
            data_sources: [{ id: 'daily-notes-data-source-id' }],
          })),
        },
      } as unknown as Client;

      const result = await findExistingResources(mockNotion, PARENT_PAGE_ID);

      assert.equal(result.flowStatePageId, FLWST_PAGE_ID);
      assert.equal(result.dailyNotesDataSourceId, 'daily-notes-data-source-id');
      assert.equal(result.tasksDataSourceId, undefined);
    });

    it('handles errors gracefully when listing children fails', async () => {
      const mockNotion = {
        search: mock.fn(async () => ({
          results: [
            {
              id: FLWST_PAGE_ID,
              parent: {
                type: 'page_id',
                page_id: PARENT_PAGE_ID,
              },
            },
          ],
        })),
        blocks: {
          children: {
            list: mock.fn(async () => {
              throw new Error('API error');
            }),
          },
        },
      } as unknown as Client;

      const result = await findExistingResources(mockNotion, PARENT_PAGE_ID);

      // Should return only flowStatePageId and fall through gracefully
      assert.equal(result.flowStatePageId, FLWST_PAGE_ID);
      assert.equal(result.dailyNotesDataSourceId, undefined);
      assert.equal(result.tasksDataSourceId, undefined);
    });
  });
});
