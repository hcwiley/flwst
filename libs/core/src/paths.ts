/**
 * File path utilities for FlowState artifacts and config.
 */

import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Get the FlowState app cache directory.
 * On macOS: ~/Library/Application Support/flwst
 * On Linux: ~/.config/flwst
 * On Windows: %APPDATA%/flwst
 */
export function getAppCacheDir(): string {
  const platform = process.platform;
  const home = homedir();

  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'flwst');
  }
  if (platform === 'linux') {
    return join(home, '.config', 'flwst');
  }
  if (platform === 'win32') {
    return join(process.env.APPDATA || home, 'flwst');
  }

  // Fallback
  return join(home, '.flwst');
}

/**
 * Get the artifacts directory path.
 */
export function getArtifactsDir(): string {
  return join(getAppCacheDir(), 'artifacts');
}

/**
 * Get the config directory path.
 */
export function getConfigDir(): string {
  return join(getAppCacheDir(), 'config');
}

/**
 * Get the path for a specific artifact bundle.
 */
export function getArtifactBundlePath(runId: string): string {
  return join(getArtifactsDir(), runId, 'bundle.json');
}

/**
 * Get the path for raw transcript artifact.
 */
export function getRawTranscriptPath(runId: string): string {
  return join(getArtifactsDir(), runId, 'raw-transcript.txt');
}

/**
 * Get the path for clean transcript artifact.
 */
export function getCleanTranscriptPath(runId: string): string {
  return join(getArtifactsDir(), runId, 'clean-transcript.txt');
}

/**
 * Get the path for daily note artifact.
 */
export function getDailyNotePath(runId: string): string {
  return join(getArtifactsDir(), runId, 'daily-note.md');
}

/**
 * Get the path for task list artifact.
 */
export function getTaskListPath(runId: string): string {
  return join(getArtifactsDir(), runId, 'task-list.json');
}

/**
 * Get the path for logs artifact.
 */
export function getLogsPath(runId: string): string {
  return join(getArtifactsDir(), runId, 'logs.json');
}
