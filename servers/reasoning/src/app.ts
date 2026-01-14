/**
 * Express application for the reasoning HTTP server.
 *
 * Registers all processing + Notion routes and a health check endpoint
 * for readiness checks from the renderer.
 */
import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { notionRouter } from './routes/notion.js';
import { orchestratorRouter } from './routes/orchestrator.js';
import { createProcessingRouter } from './routes/processing.js';
import { notionClient } from './mcp-client.js';

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/', createProcessingRouter());
  app.use('/api', chatRouter);
  app.use('/api/notion', notionRouter);
  app.use('/api/orchestrator', orchestratorRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/notion/tools', async (_req, res) => {
    try {
      const tools = await notionClient.getTools();
      res.json(tools);
    } catch (error) {
      console.error('Error fetching tools:', error);
      res.status(500).json({ error: 'Failed to fetch tools' });
    }
  });

  app.get('/api/notion/tasks', async (req, res) => {
    try {
      const query = (req.query.query as string) || '';
      const project = req.query.project as string | undefined;
      const result = await notionClient.listTasks(query, project);
      res.json(result);
    } catch (error) {
      console.error('Error listing tasks:', error);
      res.status(500).json({ error: 'Failed to list tasks' });
    }
  });

  app.get('/api/notion/tasks/search', async (req, res) => {
    try {
      const query = (req.query.query as string) || '';
      const project = req.query.project as string | undefined;
      const result = await notionClient.searchTasks(query, project);
      res.json(result);
    } catch (error) {
      console.error('Error searching tasks:', error);
      res.status(500).json({ error: 'Failed to search tasks' });
    }
  });

  return app;
}

const app = createApp();

export { app };
