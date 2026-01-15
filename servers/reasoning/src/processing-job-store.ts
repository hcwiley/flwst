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
  ProcessTranscriptJobStatus,
  ProcessTranscriptRequest,
  ProcessTranscriptResponse,
} from '@flwst/types/src/api/reasoning';
import { runReasoningPipeline } from './runner.js';

const DEFAULT_JOB_TTL_MS = 60 * 60 * 1000;

type ProcessingJobRecord = ProcessTranscriptJobResponse;

type ProcessingJobStoreOptions = {
  runPipeline?: (payload: ProcessTranscriptRequest) => Promise<ProcessTranscriptResponse>;
  maxAgeMs?: number;
};

export class ProcessingJobStore {
  private jobs = new Map<string, ProcessingJobRecord>();
  private runPipeline: (payload: ProcessTranscriptRequest) => Promise<ProcessTranscriptResponse>;
  private maxAgeMs: number;

  constructor(options: ProcessingJobStoreOptions = {}) {
    this.runPipeline = options.runPipeline ?? runReasoningPipeline;
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
      phase: 'reasoning',
    });

    try {
      const result = await this.runPipeline(payload);
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

export type { ProcessingJobRecord, ProcessingJobStoreOptions };
