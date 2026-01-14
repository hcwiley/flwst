import dotenv from 'dotenv';
import readline from 'node:readline';
import { runReasoningPipeline } from './runner.js';
import {
  SubprocessRequestSchema,
  buildErrorResponse,
  buildSuccessResponse,
} from './subprocess-protocol.js';

// Load environment variables immediately
dotenv.config();

/**
 * Reasoning subprocess entrypoint.
 *
 * Exposes a JSON-lines protocol over stdin/stdout to keep the reasoning
 * pipeline stateless and managed by Electron main.
 */
console.log = (...args: unknown[]) => console.error(...args);
console.info = (...args: unknown[]) => console.error(...args);
console.debug = (...args: unknown[]) => console.error(...args);
const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let requestId = 'unknown';
  try {
    const parsed = SubprocessRequestSchema.parse(JSON.parse(trimmed));
    requestId = parsed.id;
    const payload = await runReasoningPipeline(parsed.payload);
    const response = buildSuccessResponse(parsed.id, payload);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    const response = buildErrorResponse(requestId, error);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
});

rl.on('close', () => {
  process.exit(0);
});
