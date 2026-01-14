import { Router } from 'express';
import { z } from 'zod';
import { extractNotionTaskProperties } from '../matching.js';
import { notionApiClient } from '../notion-api.js';
import { MCPNotionClient } from '../notion-client.js';
import {
  NotionMatchRequestSchema,
  NotionMatchResponseSchema,
  NotionContextResponseSchema,
  SubmitToNotionRequestSchema,
  Todo,
} from '@flwst/types/src/api/reasoning';
import { notionConfig } from '../../../../config/notion.js';

/**
 * Phase 2: Match todos with Notion tasks and enrich them.
 * Returns enriched todos with Notion data (notionUrl, isMatched, etc.)
 */
export const notionRouter = Router();

/**
 * In-memory store for todo updates made in the app.
 * Keyed by todo.id, stores partial Todo updates (status, priority, etc.)
 * This allows the server to track changes before submission.
 */
const todoUpdatesStore = new Map<string, Partial<Todo>>();

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

    let connectionErrorDetected = false;

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
        } catch (err: any) {
          // Check if this is a connection error
          const isConnectionError =
            err?.isConnectionError === true ||
            err?.message?.includes('Not connected') ||
            err?.message?.includes('connection');

          if (isConnectionError) {
            connectionErrorDetected = true;
            // Don't log every single error to avoid spam
            if (!connectionErrorDetected || allNotionTasks.length === 0) {
              console.warn(
                `[notion-router] Notion MCP connection error. Searches will return empty results.`,
              );
            }
          } else {
            console.warn(`Search failed for ${todo.text}:`, err);
          }
        }
      }
    }

    const enrichedTodos = await notionClient.matchTodosToNotionTasks(todos, allNotionTasks);

    // Include a warning in the response if connection errors were detected
    const response: any = { todos: enrichedTodos };
    if (connectionErrorDetected && allNotionTasks.length === 0) {
      response.warning =
        'Notion MCP connection error. No tasks were matched. Please reconnect to Notion and try again.';
    }

    res.json(response);
  } catch (error) {
    console.error('Error matching todos with Notion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a todo's properties (status, priority, etc.)
 * Stores updates in memory to be merged during submission
 */
const UpdateTodoRequestSchema = z.object({
  todoId: z.string(),
  updates: z.object({
    status: z.enum(['TODO', 'On Deck', 'In Progress', 'BLOCKED', 'Done', 'Cancelled']).optional(),
    priority: z.enum(['TOP', 'High', 'Medium', 'Low', 'Back burner']).optional(),
    project: z.string().optional(),
    description: z.string().optional(),
    dueDate: z.string().optional(),
    tags: z.array(z.string()).optional(),
    assignee: z.string().optional(),
  }),
});

notionRouter.post('/todos/update', async (req, res) => {
  try {
    const parsed = UpdateTodoRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request data', details: parsed.error });
    }

    const { todoId, updates } = parsed.data;

    // Merge with existing updates for this todo
    const existingUpdates = todoUpdatesStore.get(todoId) || {};
    const mergedUpdates = { ...existingUpdates, ...updates };
    todoUpdatesStore.set(todoId, mergedUpdates);

    console.debug(
      `[notion-router] Stored updates for todo ${todoId}:`,
      Object.keys(mergedUpdates).join(', '),
    );

    res.json({ success: true, todoId, updates: mergedUpdates });
  } catch (error: any) {
    console.error('[notion-router] Error updating todo:', error);
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

    const { dailyNoteRichMarkdown, todos: requestTodos } = parsed.data;
    const notionClient = new MCPNotionClient();

    // Merge server-stored updates with request todos
    const mergedTodos: Todo[] = requestTodos.map((todo) => {
      const storedUpdates = todoUpdatesStore.get(todo.id);
      if (storedUpdates) {
        // Merge stored updates with the todo from the request
        // Stored updates take precedence (they're the latest user changes)
        const merged = { ...todo, ...storedUpdates };
        console.debug(
          `[notion-router] Merged stored updates for todo ${todo.id}:`,
          Object.keys(storedUpdates).join(', '),
        );
        return merged;
      }
      return todo;
    });

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

    // 2. Process Todos using the merged data
    const submissionResults = [];
    const processedTodoIds = new Set<string>();

    for (const todo of mergedTodos) {
      try {
        let result;
        if (todo.isMatched && todo.notionId) {
          // Use updateTodo() to update all properties (status, priority, description, etc.)
          await notionClient.updateTodo(todo);
          result = { id: todo.notionId };
        } else {
          // Create new todo with all properties including any updates
          result = await notionClient.createTodo(todo, dailyNoteId);
        }
        submissionResults.push({ id: todo.id, notionId: result.id, success: true });
        processedTodoIds.add(todo.id);
      } catch (err: any) {
        submissionResults.push({ id: todo.id, success: false, error: err.message });
      }
    }

    // Clear stored updates for successfully processed todos
    for (const todoId of processedTodoIds) {
      todoUpdatesStore.delete(todoId);
    }
    console.debug(
      `[notion-router] Cleared stored updates for ${processedTodoIds.size} todos after submission`,
    );

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
