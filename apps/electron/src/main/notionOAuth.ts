/**
 * Notion OAuth flow implementation.
 * Handles OAuth authorization code flow with local callback server.
 */

import { createServer, Server } from 'node:http';
import { URL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { getLogger } from './sentry';

const logger = getLogger();

/**
 * OAuth configuration from environment variables.
 */
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Get OAuth configuration from environment variables.
 * Throws if required variables are missing.
 */
function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Notion OAuth configuration. Required: NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, NOTION_REDIRECT_URI',
    );
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Generate OAuth authorization URL.
 */
function generateAuthUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
  });

  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

/**
 * Start a local HTTP server to receive OAuth callback.
 * Returns a promise that resolves with the authorization code.
 */
function startCallbackServer(
  redirectUri: string,
  state: string,
  timeout: number = 300000, // 5 minutes
): Promise<string> {
  return new Promise((resolve, reject) => {
    const callbackUrl = new URL(redirectUri);
    // Extract port from redirect URI, default to 3000 if not specified
    const port = callbackUrl.port ? parseInt(callbackUrl.port, 10) : 3000;

    let server: Server | null = null;
    const timeoutId = setTimeout(() => {
      if (server) {
        server.close();
      }
      reject(new Error('OAuth callback timeout'));
    }, timeout);

    server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const code = url.searchParams.get('code');
      const receivedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400);
        res.end(`OAuth error: ${error}`);
        if (server) {
          server.close();
        }
        clearTimeout(timeoutId);
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (receivedState !== state) {
        res.writeHead(400);
        res.end('Invalid state parameter');
        if (server) {
          server.close();
        }
        clearTimeout(timeoutId);
        reject(new Error('Invalid state parameter'));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code');
        if (server) {
          server.close();
        }
        clearTimeout(timeoutId);
        reject(new Error('Missing authorization code'));
        return;
      }

      // Success - send response and close server
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body>
            <h1>Authorization successful!</h1>
            <p>You can close this window and return to the application.</p>
            <script>window.close();</script>
          </body>
        </html>
      `);

      if (server) {
        server.close();
      }
      clearTimeout(timeoutId);
      resolve(code);
    });

    server.listen(port, '127.0.0.1', () => {
      logger.info('OAuth callback server started', { port, redirectUri });
    });

    server.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Exchange authorization code for access token.
 * Notion requires Basic Auth with client_id:client_secret.
 */
async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string,
): Promise<{
  access_token: string;
  workspace_id: string;
  workspace_name?: string;
  bot_id?: string;
}> {
  const basicAuth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString('base64');

  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to exchange code for token: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  return data;
}

/**
 * Complete OAuth flow: generate URL, start callback server, exchange code for token.
 * Returns access token and workspace metadata.
 *
 * This function starts the callback server, generates the auth URL, and waits for the callback.
 * The caller should open the returned authUrl in a browser.
 */
export async function completeNotionOAuth(): Promise<{
  authUrl: string;
  result: Promise<{
    accessToken: string;
    workspace: {
      workspaceId: string;
      workspaceName?: string;
      botId?: string;
    };
  }>;
}> {
  const config = getOAuthConfig();
  const state = randomBytes(16).toString('hex');
  const authUrl = generateAuthUrl(config, state);

  logger.info('Starting Notion OAuth flow', {
    authUrl: authUrl.replace(config.clientId, '***'),
    redirectUri: config.redirectUri,
  });

  // Start callback server before opening browser
  const codePromise = startCallbackServer(config.redirectUri, state);

  // Return authUrl and a promise that resolves when OAuth completes
  const resultPromise = codePromise.then(async (code) => {
    // Exchange code for token
    const tokenData = await exchangeCodeForToken(config, code);

    logger.info('Notion OAuth completed', {
      workspaceId: tokenData.workspace_id,
      hasWorkspaceName: !!tokenData.workspace_name,
      hasBotId: !!tokenData.bot_id,
    });

    return {
      accessToken: tokenData.access_token,
      workspace: {
        workspaceId: tokenData.workspace_id,
        workspaceName: tokenData.workspace_name,
        botId: tokenData.bot_id,
      },
    };
  });

  return { authUrl, result: resultPromise };
}
