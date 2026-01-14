/**
 * Notion Client Adapter
 *
 * Wraps existing Notion API/MCP logic to provide a unified interface for
 * the orchestrator, enabling dependency injection for testing.
 */

import {
  Todo,
  NotionContextResponse,
  NotionContextResponseSchema,
} from '@flwst/types/api/reasoning';
import { INotionClient } from './orchestrator.js';
import { notionClient } from './mcp-client.js';
import { notionApiClient } from './notion-api.js';
import { matchTodosToNotionTasks, extractNotionTaskProperties } from './matching.js';
import { notionConfig } from '../../../config/notion.js';

/**
 * MCPNotionClient
 *
 * Implements INotionClient using the existing Notion MCP client and API client.
 * Combines MCP for search/fetch with API for create/update operations.
 */
export class MCPNotionClient implements INotionClient {
  /**
   * Fetch Notion context (projects, examples, stats)
   */
  async fetchContext(): Promise<NotionContextResponse> {
    // If not connected via OAuth, throw error
    if (!notionApiClient.hasToken()) {
      throw new Error('Notion not connected. Please connect via OAuth first.');
    }

    const tasksDbId = notionConfig?.databases?.tasks?.id;
    if (!tasksDbId) {
      throw new Error('Tasks database ID not found in notionConfig');
    }

    // Fetch database schema to get ALL possible Projects
    const db = (await notionApiClient.getDatabase(tasksDbId)) as any;
    const projectProp = db?.properties?.Project;

    let projects: string[] = [];
    if (projectProp) {
      const options =
        projectProp.select?.options ??
        projectProp.multi_select?.options ??
        projectProp.status?.options ??
        [];
      projects = options
        .map((o: any) => o.name)
        .filter(Boolean)
        .sort();
    }

    // Fetch tasks to calculate stats and get examples
    const recentTasks = (await notionApiClient.queryDatabase(tasksDbId)) as any;
    const examplesByProject = new Map<string, string[]>();

    const stats = {
      total: recentTasks.results?.length ?? 0,
      todo: 0,
      inProgress: 0,
      done: 0,
    };

    for (const page of recentTasks.results || []) {
      const props = extractNotionTaskProperties(page);

      // Calculate stats
      const status = props.status?.toLowerCase() || '';
      if (status.includes('todo') || status.includes('on deck')) {
        stats.todo++;
      } else if (status.includes('progress') || status.includes('in progress')) {
        stats.inProgress++;
      } else if (status.includes('done') || status.includes('complete')) {
        stats.done++;
      }

      if (!props.project || !props.name) continue;

      const existing = examplesByProject.get(props.project) ?? [];
      if (existing.length < 3 && !existing.includes(props.name)) {
        examplesByProject.set(props.project, [...existing, props.name]);
      }
    }

    const examples = [...examplesByProject.entries()]
      .map(([project, titles]) => ({ project, titles }))
      .sort((a, b) => a.project.localeCompare(b.project));

    return NotionContextResponseSchema.parse({
      seed: 'official-api',
      sampledCount: recentTasks.results?.length ?? 0,
      projects,
      examples,
      stats,
    });
  }

  /**
   * Check if an error is a connection error
   */
  private isConnectionError(error: any): boolean {
    if (!error) return false;
    return (
      (error as any).isConnectionError === true ||
      error.message?.includes('Not connected') ||
      error.message?.includes('not connected') ||
      error.message?.includes('connection lost')
    );
  }

  /**
   * Search for Notion tasks matching keywords
   * Returns empty array on connection errors instead of throwing
   */
  async searchTasks(query: string, project?: string): Promise<any[]> {
    try {
      console.debug(
        `[notion-client] Searching for tasks with query: "${query}" (project: ${project || 'none'})`,
      );
      // Use MCP client for search
      if (!query || query.trim().length === 0) {
        // If query is empty but project is specified, try to search by project
        // For now, return empty array - caller should handle this
        return [];
      }

      const results = await notionClient.searchTasks(query.trim());
      const pages: any[] = [];

      // Parse MCP response format
      if (Array.isArray(results)) {
        pages.push(...results);
      } else if (results && typeof results === 'object') {
        pages.push(results);
      }

      console.debug(
        `[notion-client] Found ${pages.length} potential search results for "${query}"`,
      );

      // Filter to only include pages from the Tasks database
      const tasksDbId = notionConfig?.databases?.tasks?.id;
      if (!tasksDbId) {
        throw new Error('Tasks database ID not found in notionConfig');
      }

      const tasksDbPages: any[] = [];
      const filteredOutCount = { noParent: 0, wrongDb: 0, wrongParentType: 0 };

      for (const page of pages) {
        // Check if page has a parent property
        if (!page.parent) {
          filteredOutCount.noParent++;
          const props = extractNotionTaskProperties(page);
          console.debug(
            `[notion-client] ✗ Filtered out "${props.name || 'unnamed'}": no parent property`,
          );
          continue;
        }

        // Check if parent is a database (not a page or workspace)
        if (page.parent.type !== 'database_id') {
          filteredOutCount.wrongParentType++;
          const props = extractNotionTaskProperties(page);
          console.debug(
            `[notion-client] ✗ Filtered out "${props.name || 'unnamed'}": parent type is "${page.parent.type}" (not database_id)`,
          );
          continue;
        }

        // Check if parent database matches Tasks database ID
        // Normalize database IDs by removing hyphens for comparison (Notion uses both formats)
        const normalizeDbId = (id: string) => id.replace(/-/g, '').toLowerCase();
        const pageDbId = page.parent.database_id || '';
        const expectedDbId = tasksDbId;

        if (normalizeDbId(pageDbId) !== normalizeDbId(expectedDbId)) {
          filteredOutCount.wrongDb++;
          const props = extractNotionTaskProperties(page);
          console.debug(
            `[notion-client] ✗ Filtered out "${props.name || 'unnamed'}": wrong database (parent.database_id="${pageDbId}" vs expected="${expectedDbId}")`,
          );
          continue;
        }

        // Page is from Tasks database - include it
        tasksDbPages.push(page);
      }

      console.debug(
        `[notion-client] Filtered to ${tasksDbPages.length} pages from Tasks database (from ${pages.length} total: ${filteredOutCount.noParent} no parent, ${filteredOutCount.wrongParentType} wrong parent type, ${filteredOutCount.wrongDb} wrong database)`,
      );

      if (tasksDbPages.length > 0) {
        const resultNames = tasksDbPages.map((p) => {
          const props = extractNotionTaskProperties(p);
          return `"${props.name || 'unnamed'}" (project: ${props.project || 'none'})`;
        });
        console.debug(`[notion-client] Tasks database search results: ${resultNames.join(', ')}`);
      }

      // Filter by project if specified
      if (project && tasksDbPages.length > 0) {
        const filtered: any[] = [];
        for (const page of tasksDbPages) {
          const props = extractNotionTaskProperties(page);
          // Permissive project filter: match if projects match OR search result has no project
          const isProjectMatch =
            !props.project || this.normalizeString(props.project) === this.normalizeString(project);

          if (isProjectMatch) {
            filtered.push(page);
            console.debug(
              `[notion-client] ✓ Kept "${props.name}" (project match: ${props.project || 'none'} matches ${project})`,
            );
          } else {
            console.debug(
              `[notion-client] ✗ Filtered out "${props.name}": project mismatch (Notion="${props.project}" vs expected="${project}")`,
            );
          }
        }
        console.debug(
          `[notion-client] Returning ${filtered.length} search results after project filtering (from ${tasksDbPages.length} Tasks database pages)`,
        );
        return filtered;
      }

      return tasksDbPages;
    } catch (error) {
      // Handle connection errors gracefully - return empty array instead of throwing
      if (this.isConnectionError(error)) {
        console.warn(
          `[notion-client] Notion MCP connection error for query "${query}". Returning empty results. Please reconnect to Notion.`,
        );
        return [];
      }
      console.error('[notion-client] Error searching tasks:', error);
      throw error;
    }
  }

  /**
   * Match todos to Notion tasks using fuzzy matching
   */
  async matchTodosToNotionTasks(todos: Todo[], notionTasks: any[]): Promise<Todo[]> {
    return matchTodosToNotionTasks(todos, notionTasks);
  }

  /**
   * Fetch page body/description from Notion
   */
  async fetchPageBody(pageId: string): Promise<string> {
    try {
      // Use MCP client to fetch the page
      const page = await notionClient.fetchTask(pageId);

      // Extract description from page properties
      const props = extractNotionTaskProperties(page);
      return props.description || '';

      // TODO: In the future, we might want to fetch the full page content blocks
      // For now, we use the Description property
    } catch (error) {
      console.error(`[notion-client] Error fetching page body for ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Update page body/description in Notion
   */
  async updatePageBody(pageId: string, markdown: string): Promise<void> {
    try {
      if (!notionApiClient.hasToken()) {
        throw new Error('Notion not connected. Please connect via OAuth first.');
      }

      // Update the Description property with markdown
      // Note: Notion API requires rich_text format, but we'll use a simple text conversion
      // For full markdown support, we'd need to convert to Notion blocks
      await notionApiClient.updatePage(pageId, {
        Description: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: markdown,
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error(`[notion-client] Error updating page body for ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Update a todo task in Notion with all properties (status, priority, description, etc.)
   */
  async updateTodo(todo: Todo): Promise<void> {
    try {
      if (!notionApiClient.hasToken()) {
        throw new Error('Notion not connected. Please connect via OAuth first.');
      }

      if (!todo.notionId) {
        throw new Error('Cannot update todo: notionId is required');
      }

      const props: any = {};

      // Update Status if provided
      if (todo.status !== undefined) {
        props.Status = { status: { name: todo.status } };
      }

      // Update Priority if provided
      if (todo.priority !== undefined) {
        props.Priority = { select: { name: todo.priority } };
      }

      // Update Project if provided
      if (todo.project !== undefined) {
        props.Project = { select: { name: todo.project } };
      }

      // Update Description if provided
      if (todo.description !== undefined) {
        props.Description = {
          rich_text: [
            {
              type: 'text',
              text: {
                content: todo.description,
              },
            },
          ],
        };
      }

      // Update Due Date if provided
      if (todo.dueDate !== undefined) {
        props['Due Date'] = { date: { start: todo.dueDate } };
      }

      // Update Tags if provided
      if (todo.tags !== undefined && todo.tags.length > 0) {
        props.Tags = {
          multi_select: todo.tags.map((tag) => ({ name: tag })),
        };
      }

      // Update Assignee if provided
      if (todo.assignee !== undefined) {
        // Note: Assignee requires a person object, this is a simplified version
        // You may need to fetch the person ID from Notion first
        props.Assignee = {
          people: [{ name: todo.assignee }],
        };
      }

      // Only update if there are properties to update
      if (Object.keys(props).length > 0) {
        await notionApiClient.updatePage(todo.notionId, props);
        console.debug(
          `[notion-client] Updated todo ${todo.notionId} with properties: ${Object.keys(props).join(', ')}`,
        );
      } else {
        console.debug(`[notion-client] No properties to update for todo ${todo.notionId}`);
      }
    } catch (error) {
      console.error(`[notion-client] Error updating todo ${todo.notionId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new todo task in Notion
   */
  async createTodo(todo: Todo, dailyNoteId?: string): Promise<{ id: string; url: string }> {
    try {
      if (!notionApiClient.hasToken()) {
        throw new Error('Notion not connected. Please connect via OAuth first.');
      }

      const tasksDbId = notionConfig?.databases?.tasks?.id;
      if (!tasksDbId) {
        throw new Error('Tasks database ID not found in notionConfig');
      }

      const props: any = {
        Name: {
          title: [{ text: { content: todo.text } }],
        },
      };

      if (todo.project) {
        props.Project = { select: { name: todo.project } };
      }
      if (todo.status) {
        props.Status = { status: { name: todo.status } };
      }
      if (todo.priority) {
        props.Priority = { select: { name: todo.priority } };
      }
      if (todo.dueDate) {
        props['Due Date'] = { date: { start: todo.dueDate } };
      }
      if (todo.description) {
        props.Description = {
          rich_text: [
            {
              type: 'text',
              text: {
                content: todo.description,
              },
            },
          ],
        };
      }

      // Link to Daily Note if provided
      if (dailyNoteId) {
        props['Daily Note'] = {
          relation: [{ id: dailyNoteId }],
        };
      }

      const resultPage = (await notionApiClient.createPage(
        { database_id: tasksDbId },
        props,
        // Optionally add description as page content blocks
        todo.description
          ? [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ type: 'text', text: { content: todo.description } }],
                },
              },
            ]
          : undefined,
      )) as any;

      return {
        id: resultPage.id,
        url: resultPage.url || `https://notion.so/${resultPage.id.replace(/-/g, '')}`,
      };
    } catch (error) {
      console.error(`[notion-client] Error creating todo:`, error);
      throw error;
    }
  }

  /**
   * Normalize string for comparison (helper)
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }
}
