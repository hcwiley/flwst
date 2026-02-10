/**
 * Stage app output and minimal runtime deps for electron-builder.
 * Copies only out/, resources/, package.json, and keytar into a flat directory
 * so the builder never follows pnpm symlinks (avoids "must be under project
 * directory" and OOM from scanning the monorepo).
 *
 * Run from apps/electron. After this, run: electron-builder --mac (or --win/--linux)
 * with cwd = release/build-staging.
 */

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const APP_ROOT = join(__dirname, '..');
const STAGING_DIR = join(APP_ROOT, 'release', 'build-staging');

function main() {
  mkdirSync(STAGING_DIR, { recursive: true });

  // Copy built output and resources (no symlinks)
  cpSync(join(APP_ROOT, 'out'), join(STAGING_DIR, 'out'), {
    recursive: true,
  });
  cpSync(join(APP_ROOT, 'resources'), join(STAGING_DIR, 'resources'), {
    recursive: true,
  });
  const buildDir = join(APP_ROOT, 'build');
  try {
    cpSync(buildDir, join(STAGING_DIR, 'build'), { recursive: true });
  } catch {
    // build/ optional (e.g. entitlements.mac.plist)
  }

  // Minimal package.json for builder (no workspace deps so no symlink resolution)
  const pkg = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8'));
  const stagingPkg = {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description ?? '',
    author: pkg.author ?? '',
    main: pkg.main,
    build: { extends: 'electron-builder.staging.yml' },
  };
  writeFileSync(
    join(STAGING_DIR, 'package.json'),
    JSON.stringify(stagingPkg, null, 2),
  );

  // Copy keytar (native module) so the packaged app can require it at runtime.
  // Must copy the entire package (not just lib/) since the native .node binary
  // is at build/Release/keytar.node
  let keytarDir;
  try {
    const keytarPkgPath = require.resolve('keytar/package.json');
    keytarDir = dirname(keytarPkgPath);
  } catch {
    throw new Error(
      'keytar not found; run pnpm install from repo root and ensure keytar is a dependency',
    );
  }
  mkdirSync(join(STAGING_DIR, 'node_modules'), { recursive: true });
  cpSync(keytarDir, join(STAGING_DIR, 'node_modules', 'keytar'), {
    recursive: true,
  });

  // Resolve Electron version from app node_modules (staging has no electron installed)
  let electronVersion;
  try {
    const electronPkgPath = require.resolve('electron/package.json', {
      paths: [APP_ROOT],
    });
    electronVersion = JSON.parse(readFileSync(electronPkgPath, 'utf8')).version;
  } catch {
    throw new Error('electron not found; run pnpm install from repo root');
  }

  // Staging-specific builder config: extend main config, output one level up.
  // Keytar is copied via extraResources to Contents/Resources/node_modules/keytar so
  // the main process require('keytar') finds it (Node looks in Resources for node_modules).
  const stagingYml = `# Staged build: no symlinks; output goes to release/
extends: ../../electron-builder.yml
electronVersion: ${JSON.stringify(electronVersion)}
directories:
  output: ".."
files:
  - out/**
  - package.json
  - resources/**
# Copy entire node_modules (only keytar) so Resources/node_modules/keytar exists
extraResources:
  - from: node_modules
    to: node_modules
`;
  writeFileSync(join(STAGING_DIR, 'electron-builder.staging.yml'), stagingYml);

  console.log('Staged to', STAGING_DIR);
  console.log('Run: cd release/build-staging && electron-builder --mac');
}

main();
