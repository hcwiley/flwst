/**
 * Unit tests for Notion sync service.
 * runSync/runTasksSync require storage and Notion API; we test exports and types.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { runSync, runTasksSync } from './sync';

describe('sync', () => {
  it('exports runSync and runTasksSync as functions', () => {
    assert.equal(typeof runSync, 'function');
    assert.equal(typeof runTasksSync, 'function');
  });

  it('runSync is async (returns Promise when called)', async () => {
    const p = runSync();
    assert.ok(p instanceof Promise);
    await assert.rejects(p);
  });

  it('runTasksSync is async (returns Promise when called)', async () => {
    const p = runTasksSync();
    assert.ok(p instanceof Promise);
    await assert.rejects(p);
  });
});
