import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { notionConfig } from '../../../config/notion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_FILE = path.join(__dirname, '../../.notion-token.json');

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

  constructor() {
    this.loadToken();
  }

  private loadToken() {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        this.accessToken = data.access_token;
        console.log('[notion-api] Loaded persisted token');
      }
    } catch (err) {
      console.error('[notion-api] Failed to load token:', err);
    }
  }

  private saveToken(token: string) {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({ access_token: token }), 'utf8');
      console.log('[notion-api] Persisted token to', TOKEN_FILE);
    } catch (err) {
      console.error('[notion-api] Failed to save token:', err);
    }
  }

  setToken(token: string) {
    this.accessToken = token;
    this.saveToken(token);
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
    this.setToken(data.access_token);
    return data;
  }

  async queryDatabase(databaseId: string, filter?: any) {
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
        filter,
        page_size: 100,
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
