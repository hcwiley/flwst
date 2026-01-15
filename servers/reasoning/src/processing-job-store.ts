/**
 * In-memory job store for transcript processing.
 *
 * Tracks async processing jobs launched by the HTTP API and exposes
 * state for polling without persisting transcript payloads to disk.
 */
import { randomUUID } from 'node:crypto';
import type {
  ProcessTranscriptJobPhase,
  ProcessTranscriptJobResponse,
  ProcessTranscriptRequest,
  ProcessTranscriptResponse,
} from '@flwst/types/src/api/reasoning';
import { LlamaLLMClient } from './llm-client.js';
import { MCPNotionClient } from './notion-client.js';
import { ReasoningOrchestrator, ReasoningState } from './orchestrator.js';
import { buildDraftResponse } from './runner.js';

const DEFAULT_JOB_TTL_MS = 60 * 60 * 1000;

type ProcessingJobRecord = ProcessTranscriptJobResponse;

type JobProgressUpdate = {
  phase: ProcessTranscriptJobPhase;
  result?: ProcessTranscriptResponse;
};

type RunStages = (
  payload: ProcessTranscriptRequest,
  onUpdate: (update: JobProgressUpdate) => void,
) => Promise<ProcessTranscriptResponse>;

type ProcessingJobStoreOptions = {
  runStages?: RunStages;
  maxAgeMs?: number;
};

export class ProcessingJobStore {
  private jobs = new Map<string, ProcessingJobRecord>();
  private runStages: RunStages;
  private maxAgeMs: number;

  constructor(options: ProcessingJobStoreOptions = {}) {
    this.runStages = options.runStages ?? runTranscriptStages;
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_JOB_TTL_MS;
  }

  createJob(payload: ProcessTranscriptRequest): ProcessingJobRecord {
    this.cleanupExpiredJobs();
    const now = new Date().toISOString();
    const jobId = randomUUID();
    const record: ProcessingJobRecord = {
      jobId,
      status: 'queued',
      phase: 'fetching',
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, record);
    void this.runJob(jobId, payload);
    return record;
  }

  getJob(jobId: string): ProcessingJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  private updateJob(jobId: string, patch: Partial<ProcessingJobRecord>): void {
    const current = this.jobs.get(jobId);
    if (!current) return;
    this.jobs.set(jobId, {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  }

  private async runJob(jobId: string, payload: ProcessTranscriptRequest): Promise<void> {
    this.updateJob(jobId, {
      status: 'running',
      phase: 'fetching',
    });

    try {
      const result = await this.runStages(payload, (update) => {
        this.updateJob(jobId, {
          phase: update.phase,
          result: update.result,
        });
      });
      this.updateJob(jobId, {
        status: 'succeeded',
        phase: 'done',
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reasoning pipeline failed';
      this.updateJob(jobId, {
        status: 'failed',
        phase: 'error',
        error: message,
      });
    }
  }

  private cleanupExpiredJobs(): void {
    const cutoff = Date.now() - this.maxAgeMs;
    for (const [jobId, job] of this.jobs.entries()) {
      const updatedAt = Date.parse(job.updatedAt);
      if (!Number.isNaN(updatedAt) && updatedAt < cutoff) {
        this.jobs.delete(jobId);
      }
    }
  }
}

async function runTranscriptStages(
  payload: ProcessTranscriptRequest,
  onUpdate: (update: JobProgressUpdate) => void,
): Promise<ProcessTranscriptResponse> {
  // Run the orchestrator incrementally so clients can poll for partial results.
  const { transcript, context, sessionId } = payload;
  const llmClient = new LlamaLLMClient();
  const notionClient = new MCPNotionClient();
  const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript, context);

  onUpdate({ phase: 'analyzing' });
  const highLevel = await orchestrator.run(ReasoningState.DAILY_NOTES_EXTRACTED);
  onUpdate({
    phase: 'reasoning',
    result: buildDraftResponse(sessionId, highLevel),
  });

  const detailed = await orchestrator.run(ReasoningState.TODOS_EXTRACTED);
  onUpdate({
    phase: 'matching',
    result: buildDraftResponse(sessionId, detailed),
  });

  const matched = await orchestrator.run(ReasoningState.TODOS_MATCHED);
  return buildDraftResponse(sessionId, matched);
}

export type { JobProgressUpdate, ProcessingJobRecord, ProcessingJobStoreOptions, RunStages };
