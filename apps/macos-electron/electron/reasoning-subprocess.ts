/**
 * Reasoning subprocess manager.
 *
 * Spawns the stateless reasoning utility and communicates via JSON lines.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import readline from 'node:readline';
import {
  ProcessTranscriptRequestSchema,
  ProcessTranscriptResponseSchema,
  type ProcessTranscriptRequest,
  type ProcessTranscriptResponse,
} from '@flwst/types/src/api/reasoning';
import type { SubprocessResponse } from '../../../servers/reasoning/src/subprocess-protocol.js';
import { getRepoRoot } from './env.js';

type ReasoningSubprocessOptions = {
  command?: string;
  args?: string[];
};

export class ReasoningSubprocess {
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<
    string,
    { resolve: (value: ProcessTranscriptResponse) => void; reject: (error: Error) => void }
  >();

  constructor(private options: ReasoningSubprocessOptions = {}) {}

  async processTranscript(payload: ProcessTranscriptRequest): Promise<ProcessTranscriptResponse> {
    const request = ProcessTranscriptRequestSchema.parse(payload);
    const child = this.ensureStarted();
    const requestId = randomUUID();

    const response = new Promise<ProcessTranscriptResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
    });

    const message = {
      id: requestId,
      type: 'processTranscript',
      payload: request,
    };
    child.stdin.write(`${JSON.stringify(message)}\n`);

    return await response;
  }

  stop(): void {
    if (!this.child) return;
    this.child.kill();
    this.child = undefined;
  }

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child;

    const { command, args, cwd } = this.resolveCommand();
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    });

    child.stderr.on('data', (chunk) => {
      console.warn('[reasoning-subprocess]', chunk.toString());
    });

    const reader = readline.createInterface({ input: child.stdout });
    reader.on('line', (line) => this.handleLine(line));

    child.on('exit', (code) => {
      const error = new Error(`Reasoning subprocess exited with code ${code}`);
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
      this.child = undefined;
    });

    this.child = child;
    return child;
  }

  private handleLine(line: string) {
    if (!line.trim()) return;
    let parsed: SubprocessResponse;

    try {
      parsed = JSON.parse(line) as SubprocessResponse;
    } catch (error) {
      console.error('[reasoning-subprocess] Failed to parse response:', error);
      return;
    }

    const pending = this.pending.get(parsed.id);
    if (!pending) return;

    if (parsed.status === 'error') {
      pending.reject(new Error(parsed.error.message));
      this.pending.delete(parsed.id);
      return;
    }

    try {
      const validated = ProcessTranscriptResponseSchema.parse(parsed.payload);
      pending.resolve(validated);
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error('Invalid subprocess response'));
    } finally {
      this.pending.delete(parsed.id);
    }
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
}
