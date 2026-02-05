/**
 * Rewrites relative export specifiers in compiled output to include `.js`.
 * This is used only for the Firebase build to satisfy Node ESM resolution.
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist-firebase');

const rewriteFile = async (filePath) => {
  const contents = await readFile(filePath, 'utf8');
  const rewritten = contents.replace(
    /from\s+['"](\.\/[^'"]+)['"]/g,
    (match, specifier) => {
      if (specifier.endsWith('.js') || specifier.endsWith('.mjs')) {
        return match;
      }
      return match.replace(specifier, `${specifier}.js`);
    },
  );

  if (rewritten !== contents) {
    await writeFile(filePath, rewritten, 'utf8');
  }
};

const walk = async (dir) => {
  const entries = await readdir(dir);
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve(dir, entry);
      const entryStat = await stat(entryPath);
      if (entryStat.isDirectory()) {
        await walk(entryPath);
        return;
      }
      if (entryPath.endsWith('.js')) {
        await rewriteFile(entryPath);
      }
    }),
  );
};

await walk(distDir);
