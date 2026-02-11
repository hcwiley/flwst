#!/usr/bin/env node
/**
 * Update VERSION file with new version from semantic-release.
 * Called by semantic-release via @semantic-release/exec plugin.
 * Usage: node scripts/update-version-file.mjs <version>
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const version = process.argv[2];
if (!version) {
  console.error('Error: version argument required');
  process.exit(1);
}

// Get current git info
const gitSha = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf-8' }).trim();
const buildTime = new Date().toISOString();

// Write VERSION file
const content = `version=${version}
gitSha=${gitSha}
buildTime=${buildTime}
`;

writeFileSync('VERSION', content, 'utf-8');
console.log(`Updated VERSION file: v${version} (${gitSha}) at ${buildTime}`);
