/**
 * CLI utility invoked by `pnpm download` to fetch GGUF model files required by
 * node-llama-cpp. The script intentionally uses zero runtime dependencies so it
 * can run inside CI as well as local shells.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';

import { config as loadEnv } from 'dotenv';

loadEnv();

/**
 * Downloads node-llama-cpp compatible GGUF models listed in MODEL_URLS.
 * Each entry supports `url|custom-name.gguf` to decouple filenames from remote
 * storage. Downloads are skipped when the file already exists.
 */
interface DownloadPlan {
  readonly url: string;
  readonly fileName: string;
  readonly targetPath: string;
}

const MODELS_DIR = path.resolve(process.env.MODEL_DOWNLOAD_DIR ?? 'models');
const RAW_URLS = process.env.MODEL_URLS ?? '';

const parsePlans = (): DownloadPlan[] => {
  return RAW_URLS.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [url, customFileName] = entry.split('|');
      const sanitizedUrl = url.trim();
      if (!sanitizedUrl.startsWith('http')) {
        throw new Error(`MODEL_URLS entry must be an HTTP(S) URL. Received: ${sanitizedUrl}`);
      }
      const fileName = customFileName?.trim().length
        ? customFileName.trim()
        : (sanitizedUrl.split('/').at(-1) ?? 'model.gguf');
      return {
        url: sanitizedUrl,
        fileName,
        targetPath: path.resolve(MODELS_DIR, fileName),
      } satisfies DownloadPlan;
    });
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const downloadModel = async (plan: DownloadPlan): Promise<void> => {
  await mkdir(path.dirname(plan.targetPath), { recursive: true });

  if (await fileExists(plan.targetPath)) {
    // eslint-disable-next-line no-console -- surfaced for developer awareness.
    console.log(`✔ model already exists: ${plan.fileName}`);
    return;
  }

  // eslint-disable-next-line no-console -- surfaced for developer awareness.
  console.log(`↓ downloading ${plan.url}`);
  const response = await fetch(plan.url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${plan.url}: ${response.status} ${response.statusText}`);
  }

  const tempPath = `${plan.targetPath}.partial`;
  const stream = createWriteStream(tempPath);
  try {
    await pipeline(response.body, stream);
    await unlink(plan.targetPath).catch(() => undefined);
    await rename(tempPath, plan.targetPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }

  // eslint-disable-next-line no-console -- surfaced for developer awareness.
  console.log(`✔ saved ${plan.fileName}`);
};

const run = async (): Promise<void> => {
  const plans = parsePlans();
  if (!plans.length) {
    throw new Error('MODEL_URLS is empty. Provide at least one GGUF URL to download.');
  }

  for (const plan of plans) {
    await downloadModel(plan);
  }
};

run().catch((error: unknown) => {
  // eslint-disable-next-line no-console -- surfaced for developer awareness.
  console.error(error);
  process.exitCode = 1;
});
