/**
 * Unit tests for encrypted storage stores.
 * Tests config, tokens, and artifacts store read/write round-trips.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigStore } from './stores';
import type { UserConfig } from '@flwst/types';
import { UserConfigSchema } from '@flwst/types';

// Mock keytar
let keychainStore: Map<string, string> = new Map();
const mockKeytar = {
  setPassword: async (service: string, account: string, password: string) => {
    keychainStore.set(`${service}:${account}`, password);
  },
  getPassword: async (
    service: string,
    account: string,
  ): Promise<string | null> => {
    return keychainStore.get(`${service}:${account}`) || null;
  },
};

test.beforeEach(() => {
  keychainStore.clear();
});

test('ConfigStore writes and reads config round-trip', async () => {
  const testDir = join(tmpdir(), `flwst-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });

  const store = new ConfigStore(testDir, mockKeytar as any);

  const testConfig: UserConfig = {
    cleanup: {
      enabled: true,
      ignoreList: ['test', 'ignore'],
      dictionary: { test: 'example' },
    },
    prompts: {
      dailyNote: 'test prompt',
      taskList: 'task prompt',
    },
    notion: {
      flowStatePageId: 'test-id',
    },
  };

  await store.write(testConfig);
  const readConfig = await store.read();

  assert.deepEqual(readConfig, testConfig);
});

test('ConfigStore returns default config when file does not exist', async () => {
  const testDir = join(tmpdir(), `flwst-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });

  const store = new ConfigStore(testDir, mockKeytar as any);
  const config = await store.read();

  // Should return a valid default config structure
  assert.equal(typeof config, 'object');
  assert.equal(typeof config.cleanup, 'object');
  assert.equal(typeof config.prompts, 'object');

  // Validate it matches the schema
  assert.equal(UserConfigSchema.safeParse(config).success, true);
});

test('ConfigStore handles corrupted encrypted file gracefully', async () => {
  const testDir = join(tmpdir(), `flwst-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });

  // Write corrupted data
  const configPath = join(testDir, 'config.encrypted');
  await writeFile(configPath, 'corrupted-data');

  const store = new ConfigStore(testDir, mockKeytar as any);

  // Should fall back to default config
  const config = await store.read();
  assert.equal(typeof config, 'object');
});
