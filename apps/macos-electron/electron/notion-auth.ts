/**
 * Notion OAuth handler for Electron main.
 *
 * Starts a local callback server and exchanges the auth code for tokens.
 */
import http from 'node:http';
import { shell } from 'electron';
import { URL } from 'node:url';
import { notionApiClient } from '../../../servers/reasoning/src/notion-api.js';

type OAuthResult = {
  connected: boolean;
  error?: string;
};

export class NotionAuth {
  private server?: http.Server;

  async connect(): Promise<OAuthResult> {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return { connected: false, error: 'Missing NOTION_CLIENT_ID or NOTION_REDIRECT_URI' };
    }

    await notionApiClient.loadToken();
    if (notionApiClient.hasToken()) {
      return { connected: true };
    }

    const redirectUrl = new URL(redirectUri);
    const port = Number(redirectUrl.port || '0');
    if (!port) {
      return { connected: false, error: 'Redirect URI must include a port' };
    }

    const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('owner', 'user');
    authUrl.searchParams.set('redirect_uri', redirectUri);

    try {
      const codePromise = this.waitForCode(port, redirectUrl.pathname);
      await shell.openExternal(authUrl.toString());
      const code = await codePromise;
      await notionApiClient.exchangeCodeForToken(code);
      return { connected: notionApiClient.hasToken() };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'OAuth failed',
      };
    }
  }

  async getStatus(): Promise<{ connected: boolean }> {
    await notionApiClient.loadToken();
    return { connected: notionApiClient.hasToken() };
  }

  private waitForCode(port: number, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        const requestUrl = new URL(req.url ?? '', `http://localhost:${port}`);
        if (requestUrl.pathname !== path) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        const code = requestUrl.searchParams.get('code');
        if (!code) {
          res.statusCode = 400;
          res.end('Missing code');
          this.server?.close();
          reject(new Error('Missing OAuth code'));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end('<html><body>Connected. You can close this window.</body></html>');
        resolve(code);
        this.server?.close();
      });

      server.on('error', (error) => reject(error));
      server.listen(port, () => {
        this.server = server;
      });
    });
  }
}
