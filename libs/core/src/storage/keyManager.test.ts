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
