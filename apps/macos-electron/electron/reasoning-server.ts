/**
 * Reasoning HTTP server manager.
 *
 * Spawns the reasoning server (if not already running) and waits for
 * /health to respond before the renderer calls /process.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { getRepoRoot } from './env.js';

const DEFAULT_PORT = 3000;
const HEALTH_TIMEOUT_MS = 1500;
const STARTUP_RETRIES = 10;
const STARTUP_BACKOFF_MS = 300;

type ReasoningServerOptions = {
  port?: number;
  command?: string;
  args?: string[];
};

export class ReasoningServerManager {
  private child?: ChildProcessWithoutNullStreams;

  constructor(private options: ReasoningServerOptions = {}) {}

  async start(): Promise<void> {
    const port = this.resolvePort();

    if (await this.isHealthy(port)) {
      return;
    }

    if (!this.child) {
      const { command, args, cwd } = this.resolveCommand();
      this.child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd,
        env: {
          ...process.env,
          REASONING_PORT: String(port),
        },
      });

      this.child.stdout.on('data', (chunk) => {
        console.log(`[reasoning-server] ${chunk.toString().trim()}`);
      });

      this.child.stderr.on('data', (chunk) => {
        console.warn(`[reasoning-server] ${chunk.toString().trim()}`);
      });

      this.child.on('exit', (code) => {
        console.warn(`[reasoning-server] exited with code ${code ?? 'unknown'}`);
        this.child = undefined;
      });
    }

    await this.waitForHealthy(port);
  }

  stop(): void {
    if (!this.child) return;
    this.child.kill();
    this.child = undefined;
  }

  private resolvePort(): number {
    const envPort = Number(process.env.REASONING_PORT);
    if (Number.isFinite(envPort) && envPort > 0) {
      return envPort;
    }
    if (this.options.port && this.options.port > 0) {
      return this.options.port;
    }
    return DEFAULT_PORT;
  }

  private resolveCommand(): { command: string; args: string[]; cwd: string } {
    if (this.options.command) {
      return {
        command: this.options.command,
        args: this.options.args ?? [],
        cwd: getRepoRoot(),
      };
    }

    const repoRoot = getRepoRoot();
    const tsxPath = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
    const entry = path.join(repoRoot, 'servers', 'reasoning', 'src', 'index.ts');

    return {
      command: tsxPath,
      args: [entry],
      cwd: repoRoot,
    };
  }

  private async waitForHealthy(port: number): Promise<void> {
    for (let attempt = 0; attempt < STARTUP_RETRIES; attempt += 1) {
      if (await this.isHealthy(port)) return;
      await sleep(STARTUP_BACKOFF_MS);
    }
    throw new Error(`Reasoning server failed to start on port ${port}`);
  }

  private async isHealthy(port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      const response = await fetch(`http://localhost:${port}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
