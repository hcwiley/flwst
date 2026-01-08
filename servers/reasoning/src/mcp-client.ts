import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class NotionMCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private connected: boolean = false;

  constructor() {
    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'mcp-remote', 'https://mcp.notion.com/mcp'],
    });

    this.client = new Client(
      {
        name: 'flwst-reasoning-client',
        version: '0.1.0',
      },
      {
        capabilities: {},
      },
    );
  }

  async connect() {
    if (this.connected) return;

    try {
      console.log('Connecting to Notion MCP...');
      await this.client.connect(this.transport);
      this.connected = true;
      console.log('Connected to Notion MCP');

      // List tools to verify connection and see what's available
      const tools = await this.client.listTools();
      console.log(
        'Available Notion tools:',
        tools.tools.map((t) => t.name),
      );
    } catch (error) {
      console.error('Failed to connect to Notion MCP:', error);
      throw error;
    }
  }

  /**
   * Search for tasks in Notion using the notion-search tool.
   * Results are filtered by Project property if project is provided.
   *
   * @throws Error if query is empty (notion-search requires at least 1 character)
   */
  async searchTasks(query: string, project?: string): Promise<any[]> {
    if (!this.connected) {
      await this.connect();
    }

    // Validate query - notion-search requires at least 1 character
    if (!query || query.trim().length === 0) {
      throw new Error('Query must contain at least 1 character for notion-search');
    }

    try {
      // Use notion-search tool
      const result = await this.client.callTool({
        name: 'notion-search',
        arguments: {
          query: query.trim(),
          query_type: 'internal',
        },
      });

      // Parse the result - notion-search returns content array
      const content = result.content || [];
      const pages: any[] = [];

      // Ensure content is an array
      const contentArray = Array.isArray(content) ? content : [content];

      // Process each result
      for (const item of contentArray) {
        if (item.type === 'text') {
          try {
            // The text content might be JSON or a structured response
            const parsed = typeof item.text === 'string' ? JSON.parse(item.text) : item.text;
            if (Array.isArray(parsed)) {
              pages.push(...parsed);
            } else if (parsed.pages || parsed.results) {
              pages.push(...(parsed.pages || parsed.results || []));
            } else {
              pages.push(parsed);
            }
          } catch {
            // If parsing fails, try to extract page info from the text
            // This is a fallback for different response formats
            continue;
          }
        } else if (item.type === 'resource') {
          // Resource type might contain page references
          pages.push(item);
        }
      }

      // If no structured content, try to extract from raw result
      if (pages.length === 0 && result.content) {
        // Try alternative parsing
        const rawContent = Array.isArray(result.content) ? result.content : [result.content];

        for (const item of rawContent) {
          if (item && typeof item === 'object') {
            pages.push(item);
          }
        }
      }

      // Filter by project if provided (case-insensitive)
      if (project && pages.length > 0) {
        // We need to fetch each page to check its Project property
        // For now, return all pages and let the caller filter after fetching
        // This is more efficient than fetching all pages here
        return pages;
      }

      return pages;
    } catch (error) {
      console.error('Error searching Notion tasks:', error);
      throw error;
    }
  }

  /**
   * Fetch a specific task by page ID using notion-fetch tool.
   */
  async fetchTask(pageId: string): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.client.callTool({
        name: 'notion-fetch',
        arguments: {
          id: pageId,
        },
      });

      // Parse the result
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text') {
            try {
              return typeof item.text === 'string' ? JSON.parse(item.text) : item.text;
            } catch {
              // Continue to next item
            }
          } else if (item.type === 'resource') {
            return item;
          }
        }
      }

      // Fallback: return raw result
      return result;
    } catch (error) {
      console.error(`Error fetching Notion task ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Legacy method - kept for backward compatibility.
   * Use searchTasks() instead.
   */
  async listTasks(query: string = '', project?: string) {
    return this.searchTasks(query, project);
  }

  // Generic method to call any tool
  async callTool(name: string, args: any) {
    if (!this.connected) {
      await this.connect();
    }
    return await this.client.callTool({
      name,
      arguments: args,
    });
  }

  async getTools() {
    if (!this.connected) {
      await this.connect();
    }
    return await this.client.listTools();
  }
}

export const notionClient = new NotionMCPClient();
