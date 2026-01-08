import { Router } from 'express';
import { extractNotionTaskProperties, matchTodosToNotionTasks } from '../matching.js';
import { notionApiClient } from '../notion-api.js';
import {
  NotionMatchRequestSchema,
  NotionMatchResponseSchema,
  NotionContextResponseSchema,
  SubmitToNotionRequestSchema,
} from '@flwst/types/api/reasoning';
import { notionConfig } from '../../../../config/notion.js';

/**
 * Extract keywords from todo text for Notion search.
 * Returns 2-3 longest words, excluding common stop words.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'must',
    'can',
    'this',
    'that',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
    'me',
    'him',
    'her',
    'us',
    'them',
    'check',
    'get',
    'buy',
    'need',
    'want',
    'go',
  ]);

  const temporalWords = new Set([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'tomorrow',
    'today',
    'yesterday',
    'next',
    'week',
    'month',
    'year',
  ]);

  // Split into words, filter out stop words and short words
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, ''))
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  // Sort: Favor non-temporal words first, then by length
  return words
    .sort((a, b) => {
      const aTemp = temporalWords.has(a);
      const bTemp = temporalWords.has(b);
      if (aTemp !== bTemp) return aTemp ? 1 : -1;
      return b.length - a.length;
    })
    .slice(0, 4)
    .filter((w) => w.length > 0);
}

/**
 * Phase 2: Match todos with Notion tasks and enrich them.
 * Returns enriched todos with Notion data (notionUrl, isMatched, etc.)
 */
export const notionRouter = Router();

/**
 * OAuth: Check if Notion is connected
 */
notionRouter.get('/status', (req, res) => {
  res.json({ connected: notionApiClient.hasToken() });
});

/**
 * OAuth: Redirect to Notion for authorization
 */
notionRouter.get('/oauth/authorize', (req, res) => {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res
      .status(500)
      .json({ error: 'Missing NOTION_CLIENT_ID or NOTION_REDIRECT_URI in server environment' });
  }

  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(notionAuthUrl);
});

/**
 * OAuth: Callback from Notion
 */
notionRouter.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Notion OAuth error: ${error}`);
  }

  if (typeof code !== 'string') {
    return res.status(400).send('Missing code in Notion OAuth callback');
  }

  try {
    await notionApiClient.exchangeCodeForToken(code);
    res.send(
      '<h1>Connected to Notion!</h1><p>You can close this window and return to the app.</p>',
    );
  } catch (err: any) {
    console.error('Failed to exchange code for token:', err);
    res.status(500).send(`Failed to connect to Notion: ${err.message}`);
  }
});

/**
 * Phase 0: Fetch lightweight Notion “context” to help the LLM classify todos.
 * Now using the official Notion API for reliable project discovery.
 */
notionRouter.get('/context', async (req, res) => {
  try {
    // If not connected via OAuth, fall back to MCP (for now) or return error
    if (!notionApiClient.hasToken()) {
      return res.status(401).json({
        error: 'Notion not connected. Please connect via OAuth first.',
        needsAuth: true,
      });
    }

    const tasksDbId = notionConfig?.databases?.tasks?.id;
    if (!tasksDbId) {
      throw new Error('Tasks database ID not found in notionConfig');
    }

    // 1) Fetch database schema to get ALL possible Projects from the select options
    console.log(`[notion/context] Fetching database schema for ${tasksDbId}...`);
    const db = await notionApiClient.getDatabase(tasksDbId);
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

    // 2) Fetch tasks to calculate stats and get examples
    console.log(`[notion/context] Fetching tasks for stats and examples...`);
    const recentTasks = await notionApiClient.queryDatabase(tasksDbId);
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

    const payload = NotionContextResponseSchema.parse({
      seed: 'official-api',
      sampledCount: recentTasks.results?.length ?? 0,
      projects,
      examples,
      stats,
    });

    console.log(
      `[notion/context] found ${payload.projects.length} projects and ${payload.examples.length} projects with examples`,
    );

    // LOG SCHEMAS for debugging relation properties
    const dailyDb = await notionApiClient.getDatabase(notionConfig.databases.dailyNotes.id);
    console.log('[notion/context] Daily Notes properties:', Object.keys(dailyDb.properties));
    const tasksDb = await notionApiClient.getDatabase(notionConfig.databases.tasks.id);
    console.log('[notion/context] Tasks properties:', Object.keys(tasksDb.properties));

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

    // Try to match todos with Notion tasks
    let enrichedTodos = todos;
    let warning: string | undefined;

    try {
      // Search for tasks per-todo using keywords extracted from todo text
      // This is more efficient than searching all tasks and avoids empty query errors
      const allNotionTasks: any[] = [];
      const seenTaskIds = new Set<string>();

      for (const todo of todos) {
        // Extract keywords from todo text
        const keywords = extractKeywords(todo.text);

        if (keywords.length > 0) {
          try {
            // Search using the top 2 keywords combined for better specificity
            const searchQuery = keywords.slice(0, 2).join(' ');
            console.log(
              `[notion/match] Searching for "${searchQuery}" (keywords: ${keywords.join(', ')})`,
            );
            const response = await notionApiClient.search(searchQuery, {
              property: 'object',
              value: 'page',
            });

            // Deduplicate results by ID
            for (const task of response.results || []) {
              if (!seenTaskIds.has(task.id)) {
                seenTaskIds.add(task.id);
                allNotionTasks.push(task);
              }
            }
          } catch (searchError) {
            // Log but continue - one failed search shouldn't break the whole flow
            console.warn(`Failed to search Notion for todo "${todo.text}":`, searchError);
          }
        }
      }

      // Match and enrich todos with Notion data
      enrichedTodos = await matchTodosToNotionTasks(todos, allNotionTasks);
    } catch (notionError) {
      // Graceful degradation: if Notion matching fails, return todos as-is with warning
      console.warn('Failed to match todos with Notion tasks:', notionError);
      warning = 'Notion matching unavailable; showing LLM results only';
      // Continue with original todos without matching
    }

    // Validate and return response
    const response = NotionMatchResponseSchema.parse({
      todos: enrichedTodos,
      ...(warning && { warning }),
    });

    res.json(response);
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

    if (!notionConfig.databases.dailyNotes.id || !notionConfig.databases.tasks.id) {
      throw new Error('Missing database IDs in notionConfig');
    }

    // 1. Create the Daily Note
    console.log('[notion/submit] Creating Daily Note...');
    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      weekday: 'long',
    });

    const dailyNotePage = await notionApiClient.createPage(
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
    );

    const dailyNoteId = dailyNotePage.id;
    console.log(`[notion/submit] Created Daily Note: ${dailyNoteId}`);

    // 2. Process Todos
    const submissionResults = [];
    for (const todo of todos) {
      try {
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

        // Try to link to the Daily Note if a Relation property exists
        // We'll guess the name is 'Daily Note' for now
        props['Daily Note'] = {
          relation: [{ id: dailyNoteId }],
        };

        let resultPage;
        if (todo.isMatched && todo.notionId) {
          console.log(`[notion/submit] Updating existing task: ${todo.notionId}`);
          resultPage = await notionApiClient.updatePage(todo.notionId, props);
        } else {
          console.log(`[notion/submit] Creating new task: ${todo.text}`);
          resultPage = await notionApiClient.createPage(
            { database_id: notionConfig.databases.tasks.id },
            props,
          );
        }
        submissionResults.push({ id: todo.id, notionId: resultPage.id, success: true });
      } catch (err: any) {
        console.error(`[notion/submit] Failed to submit todo "${todo.text}":`, err.message);
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
