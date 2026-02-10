/**
 * Register process.resourcesPath/node_modules for require() in the packaged app.
 * Must be imported first in main so keytar (shipped via extraResources) is found.
 */
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('module') as { globalPaths: string[] };

if (process.resourcesPath) {
  const resourceNodeModules = join(process.resourcesPath, 'node_modules');
  if (!Module.globalPaths.includes(resourceNodeModules)) {
    Module.globalPaths.push(resourceNodeModules);
  }
}
