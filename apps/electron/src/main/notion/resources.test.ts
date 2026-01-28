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
} from './resources';
import {
  FLOW_STATE_PAGE_TITLE,
  DAILY_NOTES_DB_TITLE,
  TASKS_DB_TITLE,
} from './constants';

describe('resources helpers', () => {
  describe('createFlowStatePage', () => {
    it('creates a page with correct parent and title', async () => {
      const mockNotion = {
        pages: {
          create: mock.fn(async () => ({
            id: 'page-id-123',
          })),
        },
      } as unknown as Client;

      const parentPageId = 'parent-page-id-456';
      const result = await createFlowStatePage(mockNotion, parentPageId);

      assert.equal(result, 'page-id-123');
      assert.equal(mockNotion.pages.create.mock.calls.length, 1);
      const call = mockNotion.pages.create.mock.calls[0];
      assert.deepEqual(call.arguments[0], {
        parent: { page_id: parentPageId },
        properties: {
          title: {
            title: [{ text: { content: FLOW_STATE_PAGE_TITLE } }],
          },
        },
      });
    });

    it('handles API errors', async () => {
      const mockNotion = {
        pages: {
          create: mock.fn(async () => {
            throw new Error('Notion API error');
          }),
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
      const mockNotion = {
        databases: {
          create: mock.fn(async () => ({
            id: 'db-id-123',
          })),
        },
      } as unknown as Client;

      const flowStatePageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const result = await createDailyNotesDatabase(
        mockNotion,
        flowStatePageId,
      );

      assert.equal(result, 'db-id-123');
      assert.equal(mockNotion.databases.create.mock.calls.length, 1);
      const call = mockNotion.databases.create.mock.calls[0];
      const payload = call.arguments[0];
      assert.equal(payload.parent.type, 'page_id');
      assert.equal(payload.parent.page_id, flowStatePageId);
      assert.equal(payload.title[0].text.content, DAILY_NOTES_DB_TITLE);
      assert.ok(payload.properties);
      assert.ok(payload.properties.Name);
    });

    it('normalizes parent page ID', async () => {
      const mockNotion = {
        databases: {
          create: mock.fn(async () => ({
            id: 'db-id-123',
          })),
        },
      } as unknown as Client;

      // Test with non-hyphenated ID
      const flowStatePageId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await createDailyNotesDatabase(mockNotion, flowStatePageId);

      const call = mockNotion.databases.create.mock.calls[0];
      const payload = call.arguments[0];
      // Should be normalized to hyphenated form
      assert.equal(
        payload.parent.page_id,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      );
    });

    it('handles API errors', async () => {
      const mockNotion = {
        databases: {
          create: mock.fn(async () => {
            throw new Error('Database creation failed');
          }),
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
      const mockNotion = {
        databases: {
          create: mock.fn(async () => ({
            id: 'tasks-db-id-123',
          })),
        },
      } as unknown as Client;

      const flowStatePageId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const result = await createTasksDatabase(mockNotion, flowStatePageId);

      assert.equal(result, 'tasks-db-id-123');
      assert.equal(mockNotion.databases.create.mock.calls.length, 1);
      const call = mockNotion.databases.create.mock.calls[0];
      const payload = call.arguments[0];
      assert.equal(payload.parent.type, 'page_id');
      assert.equal(payload.parent.page_id, flowStatePageId);
      assert.equal(payload.title[0].text.content, TASKS_DB_TITLE);
      assert.ok(payload.properties);
      assert.ok(payload.properties.Name);
      assert.ok(payload.properties.Status);
      assert.ok(payload.properties.Priority);
    });

    it('logs and rethrows errors', async () => {
      const mockNotion = {
        databases: {
          create: mock.fn(async () => {
            throw new Error('Tasks database creation failed');
          }),
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
});
