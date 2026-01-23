/**
 * Unit tests for keychain-based key manager.
 * Tests key creation, retrieval, and stable key reuse.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { KeyManager } from './keyManager';

// Mock keytar for testing
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
  deletePassword: async (service: string, account: string) => {
    keychainStore.delete(`${service}:${account}`);
  },
};

test.beforeEach(() => {
  keychainStore.clear();
});

test('KeyManager creates new key on first access', async () => {
  const manager = new KeyManager(mockKeytar as any);

  const key1 = await manager.getOrCreateKey();

  assert.equal(key1.length, 32); // 256 bits = 32 bytes
  assert.equal(typeof key1, 'object');
  assert(Buffer.isBuffer(key1));
});

test('KeyManager reuses existing key from keychain', async () => {
  const manager = new KeyManager(mockKeytar as any);

  const key1 = await manager.getOrCreateKey();
  const key2 = await manager.getOrCreateKey();

  assert.deepEqual(key1, key2);
});

test('KeyManager creates stable key across instances', async () => {
  const manager1 = new KeyManager(mockKeytar as any);
  const key1 = await manager1.getOrCreateKey();

  const manager2 = new KeyManager(mockKeytar as any);
  const key2 = await manager2.getOrCreateKey();

  assert.deepEqual(key1, key2);
});

test('KeyManager handles keychain read failure gracefully', async () => {
  const failingKeytar = {
    getPassword: async () => {
      throw new Error('keychain error');
    },
    setPassword: async () => {
      // Should not be called if getPassword fails
    },
  };

  const manager = new KeyManager(failingKeytar as any);

  await assert.rejects(
    async () => await manager.getOrCreateKey(),
    /keychain error/,
  );
});

test('KeyManager prevents race condition on concurrent key creation', async () => {
  // Track how many times setPassword is called
  let setPasswordCallCount = 0;
  const raceTestKeytar = {
    setPassword: async (service: string, account: string, password: string) => {
      setPasswordCallCount++;
      // Simulate some delay to increase chance of race condition
      await new Promise((resolve) => setTimeout(resolve, 10));
      keychainStore.set(`${service}:${account}`, password);
    },
    getPassword: async (
      service: string,
      account: string,
    ): Promise<string | null> => {
      return keychainStore.get(`${service}:${account}`) || null;
    },
  };

  // Clear keychain before test
  keychainStore.clear();

  // Create multiple managers (simulating ConfigStore and TokensStore)
  const manager1 = new KeyManager(raceTestKeytar as any);
  const manager2 = new KeyManager(raceTestKeytar as any);
  const manager3 = new KeyManager(raceTestKeytar as any);

  // Make concurrent calls to getOrCreateKey
  const [key1, key2, key3] = await Promise.all([
    manager1.getOrCreateKey(),
    manager2.getOrCreateKey(),
    manager3.getOrCreateKey(),
  ]);

  // All keys should be identical
  assert.deepEqual(key1, key2);
  assert.deepEqual(key2, key3);

  // Only one key should have been written to keychain
  assert.equal(setPasswordCallCount, 1);

  // Verify the key in keychain matches what was returned
  const storedKey = await raceTestKeytar.getPassword(
    'com.flowstate.app',
    'encryption-key',
  );
  assert.ok(storedKey);
  assert.deepEqual(key1, Buffer.from(storedKey, 'base64'));
});
