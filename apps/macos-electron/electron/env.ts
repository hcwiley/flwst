/**
 * Environment loader for Electron main.
 *
 * Ensures the repo-root .env is loaded in dev without relying on dist output.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let loaded = false;

export function getRepoRoot(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, '../../..');
}

export function loadEnv(): void {
  if (loaded) return;
  const repoRoot = getRepoRoot();
  dotenv.config({ path: path.join(repoRoot, '.env') });
  loaded = true;
}
