/**
 * Reasoning HTTP server entrypoint.
 *
 * Boots the Express app and exposes JSON over HTTP so stdout logging
 * is safe and transport parsing is no longer required.
 */
import dotenv from 'dotenv';
import { app } from './app.js';

// Load environment variables immediately
dotenv.config();

const port = Number(process.env.REASONING_PORT ?? 3000);
const server = app.listen(port, () => {
  console.log(`[reasoning] HTTP server listening on port ${port}`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
