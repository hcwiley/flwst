/**
 * Clear local storage script for development.
 * Removes encrypted storage files to allow fresh onboarding.
 */

import { rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const platform = process.platform;
let storagePath;

if (platform === 'darwin') {
  storagePath = join(
    homedir(),
    'Library',
    'Application Support',
    '@flwst',
    'electron',
    'storage',
  );
} else if (platform === 'win32') {
  storagePath = join(
    process.env.APPDATA || '',
    '@flwst',
    'electron',
    'storage',
  );
} else {
  // Linux and other Unix-like systems
  storagePath = join(homedir(), '.config', '@flwst', 'electron', 'storage');
}

console.log('Attempting to clear storage at:', storagePath);

try {
  rmSync(storagePath, { recursive: true, force: true });
  console.log('✓ Storage cleared successfully');
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('✓ No storage to clear (path does not exist)');
  } else {
    console.error('✗ Error clearing storage:', err.message);
    process.exit(1);
  }
}
