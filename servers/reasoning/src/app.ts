import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { notionRouter } from './routes/notion.js';
import { orchestratorRouter } from './routes/orchestrator.js';
import { notionClient } from './mcp-client.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', chatRouter);
app.use('/api/notion', notionRouter);
app.use('/api/orchestrator', orchestratorRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/notion/tools', async (req, res) => {
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

export { app };
