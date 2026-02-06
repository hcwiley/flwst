import { TaskProps } from './../../../../types/src/api';
/**
 * Client-side ingest pipeline for transcript inputs.
 * Responsible for deterministic run IDs, preprocess transforms, and artifact writes.
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  createRunIdFromFilename,
  getArtifactBundlePath,
  getArtifactsDir,
  getCleanTranscriptPath,
  getDailyNotePath,
  getDailyNotePropsPath,
  getLlmRawOutputPath,
  getLogsPath,
  getRawTranscriptPath,
  getTaskFeedPath,
  getTaskFeedPropsPath,
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

const REUSE_LLM_OUTPUT =
  process.env.NODE_ENV === 'development' &&
  process.env.FLWST_REUSE_LLM_OUTPUT === 'true';

const logger = getLogger();
logger.info('Ingest configuration', {
  REUSE_LLM_OUTPUT,
  NODE_ENV: process.env.NODE_ENV,
  FLWST_REUSE_LLM_OUTPUT: process.env.FLWST_REUSE_LLM_OUTPUT,
});

const llmClient = new FlwstApiClient({
  baseUrl: API_BASE_URL,
  timeout: 120_000,
});

interface CachedLlmOutput {
  runId: RunId;
  dailyNote: string;
  dailyNoteProps?: {
    name: string;
    date: string;
    summary: string;
    tags: string[];
  };
  taskFeed: string;
  taskFeedProps?: {
    name: string;
    project?: string;
    description?: string;
    priority: string;
    status: string;
    tags: string[];
    due?: string;
  }[];
}

/**
 * Load the latest cached LLM artifacts for dev-mode reuse.
 */
async function loadLatestLlmOutput(): Promise<CachedLlmOutput | null> {
  try {
    const artifactsDir = getArtifactsDir();
    const entries = await readdir(artifactsDir, { withFileTypes: true });
    const runDirs = entries.filter((entry) => entry.isDirectory());

    let latest: { runId: RunId; mtimeMs: number } | null = null;

    for (const entry of runDirs) {
      const dailyNotePath = join(artifactsDir, entry.name, 'daily-note.md');
      const taskFeedPath = join(artifactsDir, entry.name, 'task-feed.md');
      try {
        const [dailyNoteStat, taskFeedStat] = await Promise.all([
          stat(dailyNotePath),
          stat(taskFeedPath),
        ]);
        const latestMtime = Math.max(
          dailyNoteStat.mtimeMs,
          taskFeedStat.mtimeMs,
        );
        if (!latest || latestMtime > latest.mtimeMs) {
          latest = { runId: entry.name as RunId, mtimeMs: latestMtime };
        }
      } catch {
        // Ignore incomplete runs without both artifacts.
      }
    }

    if (!latest) return null;

    const dailyNotePath = join(artifactsDir, latest.runId, 'daily-note.md');
    const dailyNotePropsPath = join(
      artifactsDir,
      latest.runId,
      'daily-note-props.json',
    );
    const taskFeedPath = join(artifactsDir, latest.runId, 'task-feed.md');
    const taskFeedPropsPath = join(
      artifactsDir,
      latest.runId,
      'task-feed-props.json',
    );

    const [dailyNote, taskFeed, dailyNotePropsRaw, taskFeedPropsRaw] =
      await Promise.all([
        readFile(dailyNotePath, 'utf8'),
        readFile(taskFeedPath, 'utf8'),
        readFile(dailyNotePropsPath, 'utf8').catch(() => ''),
        readFile(taskFeedPropsPath, 'utf8').catch(() => ''),
      ]);

    const dailyNoteProps = dailyNotePropsRaw
      ? (JSON.parse(dailyNotePropsRaw) as CachedLlmOutput['dailyNoteProps'])
      : undefined;
    const taskFeedProps = taskFeedPropsRaw
      ? (JSON.parse(taskFeedPropsRaw) as CachedLlmOutput['taskFeedProps'])
      : undefined;

    return {
      runId: latest.runId,
      dailyNote,
      dailyNoteProps,
      taskFeed,
      taskFeedProps,
    };
  } catch {
    return null;
  }
}

/**
 * Count task rows from the markdown task feed table.
 */
function countTaskRows(markdown: string): number {
  const rows = markdown.match(/^\|[^|]+\|/gm) ?? [];
  return Math.max(0, rows.length - 1);
}

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
  dailyNotePropsPath: string;
  taskFeedPath: string;
  taskFeedPropsPath: string;
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
    if (REUSE_LLM_OUTPUT) {
      const cached = await loadLatestLlmOutput();
      if (cached) {
        llmResponse = {
          runId,
          timestamp: timestamp.toISOString(),
          dailyNote: {
            content: cached.dailyNote,
            props: {
              name: cached.dailyNoteProps?.name ?? '',
              date: cached.dailyNoteProps?.date ?? '',
              summary: cached.dailyNoteProps?.summary ?? '',
              tags: cached.dailyNoteProps?.tags ?? [],
            },
          },
          taskFeed: {
            content: cached.taskFeed,
            taskCount: countTaskRows(cached.taskFeed),
            props: cached.taskFeedProps ?? [],
          },
          metadata: {
            model: 'cached',
            durationMs: 0,
          },
        };
        llmSuccess = true;
        logs.push(
          createLog('info', 'LLM generation reused', {
            sourceRunId: cached.runId,
          }),
        );
      } else {
        logs.push(
          createLog('info', 'LLM reuse requested but no cached output found'),
        );
      }
    }

    if (!llmResponse) {
      llmResponse = await llmClient.generate(generateRequest);
      llmSuccess = true;
      logs.push(
        createLog('info', 'LLM generation completed', {
          model: llmResponse.metadata.model,
          durationMs: llmResponse.metadata.durationMs,
          taskCount: llmResponse.taskFeed.taskCount,
        }),
      );
    }
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
  const dailyNotePropsPath = getDailyNotePropsPath(runId);
  const taskFeedPath = getTaskFeedPath(runId);
  const taskFeedPropsPath = getTaskFeedPropsPath(runId);
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
          writeFile(
            dailyNotePropsPath,
            JSON.stringify(llmResponse.dailyNote.props, null, 2),
            'utf8',
          ),
          writeFile(taskFeedPath, llmResponse.taskFeed.content, 'utf8'),
          writeFile(
            taskFeedPropsPath,
            JSON.stringify(llmResponse.taskFeed.props, null, 2),
            'utf8',
          ),
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
    taskFeedPropsPath,
  });

  // if we're in development load taskFeedProps from the file system and print it
  if (process.env.NODE_ENV === 'development') {
    const taskFeedPropsStr = await readFile(taskFeedPropsPath, 'utf8');
    try {
      const taskFeedProps = JSON.parse(taskFeedPropsStr) as TaskProps[];
      logger.debug('taskFeedProps', { taskFeedProps });
    } catch (error) {
      logger.error('Failed to parse taskFeedProps', { error });
    }
  }

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
    dailyNotePropsPath,
    taskFeedPath,
    taskFeedPropsPath,
    llmDurationMs,
    llmSuccess,
    llmError,
  };
}
