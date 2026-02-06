/**
 * Unit tests for publish module: property building and create/update with mocked Notion client.
 */

import { strict as assert } from 'node:assert';
import { describe, it, mock } from 'node:test';
import { createTaskPage, updateTaskPage } from './publish';
import type { DraftTask } from './dedup';

describe('publish', () => {
  describe('createTaskPage', () => {
    it('calls notion.pages.create with data source parent and draft properties', async () => {
      const createdId = 'created-page-id';
      const createMock = mock.fn(() => Promise.resolve({ id: createdId }));
      const notion = {
        pages: { create: createMock },
      } as unknown as import('@notionhq/client').Client;

      const draft: DraftTask = {
        name: 'Test Task',
        status: 'To-do',
        priority: 'high',
        project: 'Acme',
        sourceRunId: 'run-123',
      };

      const dbId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const id = await createTaskPage(notion, dbId, draft);
      assert.equal(id, createdId);
      assert.equal(createMock.mock.calls.length, 1);
      const [payload] = createMock.mock.calls[0].arguments as unknown as [
        {
          parent: { type: string; data_source_id: string };
          properties: Record<string, unknown>;
        },
      ];
      assert.equal(payload.parent.type, 'data_source_id');
      assert.ok(payload.parent.data_source_id.length === 36);
      assert.ok(payload.properties.Name);
      assert.ok(
        (payload.properties.Name as { title: { text: { content: string } }[] })
          .title[0].text.content === 'Test Task',
      );
      assert.ok(payload.properties.Status);
      assert.ok(payload.properties.Priority);
      assert.ok(payload.properties.Project);
      assert.ok(payload.properties['Source Run ID']);
    });

    it('includes optional description, tags, and due date when present', async () => {
      const createMock = mock.fn(() => Promise.resolve({ id: 'id' }));
      const notion = {
        pages: { create: createMock },
      } as unknown as import('@notionhq/client').Client;

      const draft: DraftTask = {
        name: 'Full Task',
        description: 'A description',
        tags: ['a', 'b'],
        due: '2025-12-01',
      };

      await createTaskPage(
        notion,
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        draft,
      );
      const [payload] = createMock.mock.calls[0].arguments as unknown as [
        { properties: Record<string, unknown> },
      ];
      assert.ok(payload.properties.Description);
      assert.ok(payload.properties.Tags);
      assert.ok(payload.properties['Due Date']);
    });
  });

  describe('updateTaskPage', () => {
    it('calls notion.pages.update with page id and draft properties', async () => {
      const updateMock = mock.fn(() => Promise.resolve(undefined));
      const notion = {
        pages: { update: updateMock },
      } as unknown as import('@notionhq/client').Client;

      const draft: DraftTask = { name: 'Updated Title', status: 'Done' };

      const pageId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
      await updateTaskPage(notion, pageId, draft);
      assert.equal(updateMock.mock.calls.length, 1);
      const [payload] = updateMock.mock.calls[0].arguments as unknown as [
        { page_id: string; properties: Record<string, unknown> },
      ];
      assert.ok(payload.page_id.length === 36);
      assert.ok(payload.properties.Name);
      assert.ok(
        (payload.properties.Name as { title: { text: { content: string } }[] })
          .title[0].text.content === 'Updated Title',
      );
      assert.ok(
        (payload.properties.Status as { status: { name: string } }).status
          .name === 'Done',
      );
    });
  });
});
