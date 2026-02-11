#!/usr/bin/env node
/**
 * Sync version from root package.json to all child packages.
 * Automatically discovers all package.json files (excluding node_modules).
 * Run with: pnpm sync:version
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read root version
const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const version = rootPkg.version;

console.log(`Syncing version ${version} to child packages...`);

// Find all package.json files (excluding node_modules and root)
const findCommand = 'find . -name "package.json" -not -path "*/node_modules/*" -not -path "./package.json"';
const packageFiles = execSync(findCommand, { cwd: rootDir, encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter(Boolean)
  .map(path => path.replace(/^\.\//, '')); // Remove leading './'

let updated = 0;
let skipped = 0;

for (const pkgPath of packageFiles) {
  const fullPath = join(rootDir, pkgPath);
  try {
    const pkg = JSON.parse(readFileSync(fullPath, 'utf-8'));
    if (pkg.version !== version) {
      pkg.version = version;
      writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      console.log(`  ✓ Updated ${pkgPath}`);
      updated++;
    } else {
      console.log(`  - ${pkgPath} already at ${version}`);
      skipped++;
    }
  } catch (err) {
    console.warn(`  ✗ Failed to update ${pkgPath}:`, err.message);
  }
}

console.log(`\nSynced ${updated} package(s) to version ${version} (${skipped} already up-to-date)`);
