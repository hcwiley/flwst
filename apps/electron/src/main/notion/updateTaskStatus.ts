/**
 * Update a Notion task status by page id.
 * Used by Kanban drag-and-drop to persist status changes.
 */

import { Client } from '@notionhq/client';
import type { TaskStatus } from '@flwst/types';
import { getTokensStore } from '../storage';
import { NotionError } from './errors';
import { normalizeNotionId } from './notionSchema';
import { normalizeStatus } from './normalize';

/**
 * Update the Status property for a task page.
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  const tokensStore = getTokensStore();
  const tokens = await tokensStore.read();
  const accessToken = tokens.notionAccessToken;
  if (!accessToken) {
    throw new NotionError('NOTION_AUTH_ERROR', 'Notion access token missing');
  }

  const normalizedStatus = normalizeStatus(status);
  if (!normalizedStatus) {
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      `Invalid status value: ${status}`,
    );
  }

  const notion = new Client({ auth: accessToken });
  await notion.pages.update({
    page_id: normalizeNotionId(taskId),
    properties: {
      Status: {
        status: { name: normalizedStatus },
      },
    },
  });
}
