import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_FILE = path.join(__dirname, '../../.notion-token.json');

export interface NotionTokenStore {
  loadToken(): Promise<string | null>;
  saveToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

class FileTokenStore implements NotionTokenStore {
  async loadToken(): Promise<string | null> {
    try {
      if (!fs.existsSync(TOKEN_FILE)) return null;
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      return data.access_token ?? null;
    } catch (err) {
      console.error('[notion-api] Failed to load token:', err);
      return null;
    }
  }

  async saveToken(token: string): Promise<void> {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({ access_token: token }), 'utf8');
      console.log('[notion-api] Persisted token to', TOKEN_FILE);
    } catch (err) {
      console.error('[notion-api] Failed to save token:', err);
    }
  }

  async clearToken(): Promise<void> {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
    } catch (err) {
      console.error('[notion-api] Failed to clear token:', err);
    }
  }
}

export interface NotionTokenResponse {
  access_token: string;
  bot_id: string;
  duplicated_template_id: string | null;
  owner: any;
  workspace_icon: string | null;
  workspace_id: string;
  workspace_name: string | null;
}

class NotionApiClient {
  private accessToken: string | null = null;
  private tokenStore: NotionTokenStore;

  constructor() {
    this.tokenStore = new FileTokenStore();
    void this.loadToken();
  }

  configureTokenStore(store: NotionTokenStore) {
    this.tokenStore = store;
  }

  async loadToken() {
    const token = await this.tokenStore.loadToken();
    if (token) {
      this.accessToken = token;
      console.log('[notion-api] Loaded persisted token');
    }
  }

  async setToken(token: string) {
    this.accessToken = token;
    await this.tokenStore.saveToken(token);
  }

  async clearToken() {
    this.accessToken = null;
    await this.tokenStore.clearToken();
  }

  hasToken(): boolean {
    return !!this.accessToken;
  }

  async exchangeCodeForToken(code: string): Promise<NotionTokenResponse> {
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Notion OAuth configuration (Client ID, Secret, or Redirect URI)');
    }

    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Notion OAuth error: ${JSON.stringify(error)}`);
    }

    const data = (await response.json()) as NotionTokenResponse;
    await this.setToken(data.access_token);
    return data;
  }

  async queryDatabase(databaseId: string, filter?: any) {
    return this.queryDatabasePage(databaseId, { filter });
  }

  /**
   * Fetch all pages from a database with pagination.
   */
  async queryDatabaseAll(databaseId: string, filter?: any, pageSize: number = 100) {
    const results: any[] = [];
    let cursor: string | null | undefined = undefined;
    let lastResponse: any = null;

    while (true) {
      const response = await this.queryDatabasePage(databaseId, {
        filter,
        startCursor: cursor ?? undefined,
        pageSize,
      });
      results.push(...(response.results ?? []));
      lastResponse = response;

      if (!response.has_more || !response.next_cursor) {
        break;
      }
      cursor = response.next_cursor;
    }

    return {
      ...lastResponse,
      results,
      has_more: false,
      next_cursor: null,
    };
  }

  private async queryDatabasePage(
    databaseId: string,
    options: {
      filter?: any;
      startCursor?: string;
      pageSize?: number;
    },
  ) {
    if (!this.accessToken) {
      throw new Error('Notion API access token not set. Please connect first.');
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        filter: options.filter,
        page_size: options.pageSize ?? 100,
        start_cursor: options.startCursor,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Notion API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async getDatabase(databaseId: string) {
    if (!this.accessToken) {
      throw new Error('Notion API access token not set. Please connect first.');
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Notion-Version': '2022-06-28',
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Notion API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async search(query: string, filter?: any) {
    if (!this.accessToken) {
      throw new Error('Notion API access token not set. Please connect first.');
    }

    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        query,
        filter,
        page_size: 50,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Notion API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async createPage(parent: { database_id: string }, properties: any, children?: any[]) {
    if (!this.accessToken) {
      throw new Error('Notion API access token not set. Please connect first.');
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        parent,
        properties,
        ...(children && { children }),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Notion API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async updatePage(pageId: string, properties: any) {
    if (!this.accessToken) {
      throw new Error('Notion API access token not set. Please connect first.');
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({
        properties,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Notion API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }
}

export const notionApiClient = new NotionApiClient();
