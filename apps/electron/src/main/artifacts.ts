/**
 * Artifacts IPC handlers.
 * Reads renderable artifact files (markdown/text) from the artifacts directory.
 */

import { ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { getArtifactsDir } from '@flwst/core';

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.json']);

function assertAllowedArtifactPath(filePath: string): void {
  const artifactsDir = getArtifactsDir();
  const resolvedPath = resolve(filePath);
  const relativePath = relative(artifactsDir, resolvedPath);
  const extension = extname(resolvedPath).toLowerCase();

  const pathSegments = relativePath.split(sep);
  const isOutsideArtifacts =
    relativePath.startsWith('..') || pathSegments.includes('..');

  if (isOutsideArtifacts || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('Invalid artifact path');
  }
}

/**
 * Register IPC handlers for artifact reads.
 */
export function registerArtifactHandlers(): void {
  ipcMain.handle(
    'artifacts:readTextFile',
    async (_event, filePath: string): Promise<string> => {
      assertAllowedArtifactPath(filePath);
      return readFile(filePath, 'utf8');
    },
  );
}
