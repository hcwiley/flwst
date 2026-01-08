import dotenv from 'dotenv';
// Load environment variables immediately
dotenv.config();

import { app } from './app.js';
import { notionClient } from './mcp-client.js';

const port = process.env.PORT || 3000;

// Initialize Notion Client (MCP)
notionClient.connect().catch((err) => {
  console.error('Failed to connect to Notion MCP on startup:', err);
});

app.listen(port, () => {
  console.log(`Reasoning server running at http://localhost:${port}`);
});
