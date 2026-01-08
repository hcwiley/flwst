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
   * Search for Notion tasks matching keywords
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
      if (pages.length > 0) {
        const resultNames = pages.map((p) => {
          const props = extractNotionTaskProperties(p);
          return `"${props.name || 'unnamed'}" (project: ${props.project || 'none'})`;
        });
        console.debug(`[notion-client] Raw search results: ${resultNames.join(', ')}`);
      }

      // Filter by project if specified
      if (project && pages.length > 0) {
        const filtered: any[] = [];
        for (const page of pages) {
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
          `[notion-client] Returning ${filtered.length} search results after project filtering (from ${pages.length} total)`,
        );
        return filtered;
      }

      return pages;
    } catch (error) {
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
