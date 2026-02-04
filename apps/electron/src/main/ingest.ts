/**
 * Client-side ingest pipeline for transcript inputs.
 * Responsible for deterministic run IDs, preprocess transforms, and artifact writes.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  createRunIdFromFilename,
  getArtifactBundlePath,
  getCleanTranscriptPath,
  getDailyNotePath,
  getLlmRawOutputPath,
  getLogsPath,
  getRawTranscriptPath,
  getTaskFeedPath,
} from '@flwst/core';
import type {
  ArtifactBundle,
  CleanTranscript,
  GenerateRequest,
  GenerateResponse,
  LogEntry,
  RawTranscript,
  RunId,
} from '@flwst/types';
import {
  ArtifactBundleSchema,
  CleanTranscriptSchema,
  RawTranscriptSchema,
} from '@flwst/types';
import { getLogger } from './sentry';
import { getConfigStore } from './storage';
import { applyPreprocess } from './preprocess';
import { FlwstApiClient } from './api/flwstApi';
import { getEffectivePrompts } from './config';

const API_BASE_URL =
  process.env.FLWST_API_URL ??
  'https://us-central1-flwst-dev.cloudfunctions.net';

const llmClient = new FlwstApiClient({
  baseUrl: API_BASE_URL,
  timeout: 120_000,
});

export interface InboxIngestRequest {
  filename?: string;
  content: string;
}

export interface InboxIngestResult {
  runId: RunId;
  timestamp: string;
  filename: string;
  rawPath: string;
  cleanPath: string;
  logsPath: string;
  bundlePath: string;
  // LLM output paths
  llmRawPath: string;
  dailyNotePath: string;
  taskFeedPath: string;
  // LLM metadata
  llmDurationMs: number;
  llmSuccess: boolean;
  llmError?: string;
}

function createLog(
  level: LogEntry['level'],
  message: string,
  metadata?: LogEntry['metadata'],
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Run ingest pipeline and persist artifacts.
 */
export async function ingestTranscript(
  request: InboxIngestRequest,
): Promise<InboxIngestResult> {
  const logger = getLogger();
  const timestamp = new Date();
  const filename = request.filename?.trim() || 'pasted-text';
  const runId = createRunIdFromFilename(filename, timestamp);

  const logs: LogEntry[] = [
    createLog('info', 'Ingest started', {
      runId,
      filename,
    }),
  ];

  const configStore = getConfigStore();
  const config = await configStore.read();
  const preprocess = config.preprocess;

  const preprocessResult = applyPreprocess(request.content, preprocess);
  const cleanContent = preprocessResult.content;
  const cleanupApplied = preprocessResult.applied;

  logs.push(
    createLog(preprocess.enabled ? 'info' : 'debug', 'Preprocess summary', {
      enabled: preprocess.enabled,
      dictionaryCount: Object.keys(preprocess.dictionary).length,
      ignoreCount: preprocess.ignoreList.length,
      applied: cleanupApplied,
    }),
  );

  // === LLM GENERATION STEP ===
  logs.push(createLog('info', 'LLM generation started'));
  const llmStartTime = Date.now();

  const resolvedPrompts = getEffectivePrompts(config.prompts);

  const generateRequest: GenerateRequest = {
    runId,
    timestamp: timestamp.toISOString(),
    preprocessedTranscript: cleanContent,
    resolvedPrompts: {
      dailyNote: resolvedPrompts.dailyNote,
      taskDraft: resolvedPrompts.taskDraft,
    },
    metadata: {
      appVersion: '0.1.0',
      preprocessEnabled: preprocess.enabled,
    },
  };

  let llmResponse: GenerateResponse | null = null;
  let llmError: string | undefined;
  let llmSuccess = false;

  try {
    llmResponse = await llmClient.generate(generateRequest);
    llmSuccess = true;
    logs.push(
      createLog('info', 'LLM generation completed', {
        model: llmResponse.metadata.model,
        durationMs: llmResponse.metadata.durationMs,
        taskCount: llmResponse.taskFeed.taskCount,
      }),
    );
  } catch (error) {
    llmError = error instanceof Error ? error.message : 'LLM generation failed';
    logs.push(createLog('error', 'LLM generation failed', { error: llmError }));
  }

  const llmDurationMs = Date.now() - llmStartTime;

  const rawTranscript: RawTranscript = RawTranscriptSchema.parse({
    runId,
    timestamp: timestamp.toISOString(),
    filename,
    content: request.content,
  });

  const cleanTranscript: CleanTranscript = CleanTranscriptSchema.parse({
    runId,
    timestamp: timestamp.toISOString(),
    originalFilename: filename,
    content: cleanContent,
    cleanupApplied,
  });

  const rawPath = getRawTranscriptPath(runId);
  const cleanPath = getCleanTranscriptPath(runId);
  const logsPath = getLogsPath(runId);
  const bundlePath = getArtifactBundlePath(runId);
  const llmRawPath = getLlmRawOutputPath(runId);
  const dailyNotePath = getDailyNotePath(runId);
  const taskFeedPath = getTaskFeedPath(runId);
  const runDir = dirname(rawPath);

  await ensureDir(runDir);

  const bundle: ArtifactBundle = ArtifactBundleSchema.parse({
    runId,
    timestamp: timestamp.toISOString(),
    rawTranscript,
    cleanTranscript,
    logs,
  });

  await Promise.all([
    writeFile(rawPath, rawTranscript.content, 'utf8'),
    writeFile(cleanPath, cleanTranscript.content, 'utf8'),
    // LLM artifacts (only write if successful)
    ...(llmResponse
      ? [
          writeFile(
            llmRawPath,
            `# Raw LLM Output\n\n${llmResponse.dailyNote.content}\n\n---\n\n${llmResponse.taskFeed.content}`,
            'utf8',
          ),
          writeFile(dailyNotePath, llmResponse.dailyNote.content, 'utf8'),
          writeFile(taskFeedPath, llmResponse.taskFeed.content, 'utf8'),
        ]
      : []),
    writeFile(logsPath, JSON.stringify(logs, null, 2), 'utf8'),
    writeFile(bundlePath, JSON.stringify(bundle, null, 2), 'utf8'),
  ]);

  logger.info('Ingest completed', {
    runId,
    filename,
    rawPath,
    cleanPath,
    logsPath,
    bundlePath,
  });

  return {
    runId,
    timestamp: timestamp.toISOString(),
    filename,
    rawPath,
    cleanPath,
    logsPath,
    bundlePath,
    llmRawPath,
    dailyNotePath,
    taskFeedPath,
    llmDurationMs,
    llmSuccess,
    llmError,
  };
}
