import { Router } from 'express';
import { extractNotionTaskProperties } from '../matching.js';
import { notionApiClient } from '../notion-api.js';
import { MCPNotionClient } from '../notion-client.js';
import {
  NotionMatchRequestSchema,
  NotionMatchResponseSchema,
  NotionContextResponseSchema,
  SubmitToNotionRequestSchema,
} from '@flwst/types/api/reasoning';
import { notionConfig } from '../../../../config/notion.js';

/**
 * Phase 2: Match todos with Notion tasks and enrich them.
 * Returns enriched todos with Notion data (notionUrl, isMatched, etc.)
 */
export const notionRouter = Router();

/**
 * Notion OAuth Flow
 */
notionRouter.get('/oauth/authorize', (req, res) => {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error('Missing NOTION_CLIENT_ID or NOTION_REDIRECT_URI');
    return res.status(500).send('OAuth configuration missing on server');
  }

  const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(authUrl);
});

notionRouter.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Notion OAuth error:', error);
    return res.status(400).send(`Authorization failed: ${error}`);
  }

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    await notionApiClient.exchangeCodeForToken(code as string);
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column;">
          <h1>Successfully connected to Notion!</h1>
          <p>You can now close this window and return to the app.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Failed to exchange code for token:', err);
    res.status(500).send(`Failed to connect to Notion: ${err.message}`);
  }
});

notionRouter.get('/status', (req, res) => {
  const connected = notionApiClient.hasToken();
  console.log(`[notion-router] Connection status check: ${connected}`);
  res.json({ connected });
});

/**
 * Phase 0: Fetch lightweight Notion “context” to help the LLM classify todos.
 * Now using the official Notion API for reliable project discovery.
 */
notionRouter.get('/context', async (req, res) => {
  try {
    const notionClient = new MCPNotionClient();
    const payload = await notionClient.fetchContext();
    res.json(payload);
  } catch (error: any) {
    console.error('Error fetching Notion context:', error);
    res.status(500).json({ error: `Failed to fetch Notion context: ${error.message}` });
  }
});

notionRouter.post('/match', async (req, res) => {
  try {
    // Validate request
    const parsed = NotionMatchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request: todos array is required' });
    }

    const { todos } = parsed.data;
    const notionClient = new MCPNotionClient();

    // Use the keyword-based search strategy from the new client
    const allNotionTasks: any[] = [];
    const seenTaskIds = new Set<string>();

    for (const todo of todos) {
      // Extract keywords from todo text (using the logic now in orchestrator or client)
      // For now, we'll keep the local keyword extraction or move it to a helper
      const keywords = todo.text
        .split(' ')
        .filter((w) => w.length > 3)
        .slice(0, 3);
      if (keywords.length > 0) {
        try {
          const tasks = await notionClient.searchTasks(keywords.join(' '), todo.project);
          for (const task of tasks) {
            if (task.id && !seenTaskIds.has(task.id)) {
              seenTaskIds.add(task.id);
              allNotionTasks.push(task);
            }
          }
        } catch (err) {
          console.warn(`Search failed for ${todo.text}:`, err);
        }
      }
    }

    const enrichedTodos = await notionClient.matchTodosToNotionTasks(todos, allNotionTasks);

    res.json({ todos: enrichedTodos });
  } catch (error) {
    console.error('Error matching todos with Notion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Phase 5: Submit Daily Note and Todos to Notion
 */
notionRouter.post('/submit', async (req, res) => {
  try {
    const parsed = SubmitToNotionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const { dailyNoteRichMarkdown, todos } = parsed.data;
    const notionClient = new MCPNotionClient();

    // 1. Create the Daily Note (using API client directly for now as client doesn't have createDailyNote)
    // TODO: Add createDailyNote to INotionClient
    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      weekday: 'long',
    });

    const dailyNotePage = (await notionApiClient.createPage(
      { database_id: notionConfig.databases.dailyNotes.id },
      {
        Name: {
          title: [{ text: { content: today } }],
        },
      },
      [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: dailyNoteRichMarkdown } }],
          },
        },
      ],
    )) as any;

    const dailyNoteId = dailyNotePage.id;

    // 2. Process Todos using the client
    const submissionResults = [];
    for (const todo of todos) {
      try {
        let result;
        if (todo.isMatched && todo.notionId) {
          await notionClient.updatePageBody(todo.notionId, todo.description || '');
          result = { id: todo.notionId };
        } else {
          result = await notionClient.createTodo(todo, dailyNoteId);
        }
        submissionResults.push({ id: todo.id, notionId: result.id, success: true });
      } catch (err: any) {
        submissionResults.push({ id: todo.id, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      dailyNoteId,
      todos: submissionResults,
    });
  } catch (error: any) {
    console.error('Error submitting to Notion:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
