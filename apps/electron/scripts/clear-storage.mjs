/**
 * Clear local storage script for development.
 * Removes encrypted storage files to allow fresh onboarding.
 * Handles both dev mode (Electron) and production (@flwst/electron) paths.
 */

import { rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const platform = process.platform;

/**
 * Get storage paths for both dev and production modes.
 * In dev, Electron uses 'Electron' as the app name.
 * In production, it uses '@flwst/electron' from package.json.
 */
function getStoragePaths() {
  const paths = [];
  if (platform === 'darwin') {
    // Production path
    paths.push(
      join(
        homedir(),
        'Library',
        'Application Support',
        '@flwst',
        'electron',
        'storage',
      ),
    );
    // Dev path (electron-vite uses 'Electron' as app name)
    paths.push(
      join(homedir(), 'Library', 'Application Support', 'Electron', 'storage'),
    );
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || '';
    // Production path
    paths.push(join(appData, '@flwst', 'electron', 'storage'));
    // Dev path
    paths.push(join(appData, 'Electron', 'storage'));
  } else {
    // Linux and other Unix-like systems
    // Production path
    paths.push(join(homedir(), '.config', '@flwst', 'electron', 'storage'));
    // Dev path
    paths.push(join(homedir(), '.config', 'Electron', 'storage'));
  }
  return paths;
}

const storagePaths = getStoragePaths();
let clearedCount = 0;
let notFoundCount = 0;

console.log('Attempting to clear storage at:');
storagePaths.forEach((path) => console.log('  -', path));

for (const storagePath of storagePaths) {
  try {
    rmSync(storagePath, { recursive: true, force: true });
    console.log(`✓ Cleared: ${storagePath}`);
    clearedCount++;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`  (not found: ${storagePath})`);
      notFoundCount++;
    } else {
      console.error(`✗ Error clearing ${storagePath}:`, err.message);
      process.exit(1);
    }
  }
}

if (clearedCount > 0) {
  console.log(`\n✓ Storage cleared successfully (${clearedCount} path(s))`);
} else if (notFoundCount === storagePaths.length) {
  console.log('\n✓ No storage to clear (paths do not exist)');
}
