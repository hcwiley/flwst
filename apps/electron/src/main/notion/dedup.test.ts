/**
 * Unit tests for dedup gate: keyword hygiene, prefilter, reconciliation, decision.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildQueryTokens,
  reconcileMcpIdsToSnapshot,
  dedupDraft,
  runDedupGate,
  type DraftTask,
} from './dedup';
import type { NotionTaskPage } from '@flwst/types';

function task(id: string, title: string): NotionTaskPage {
  return {
    id,
    url: `https://notion.so/${id}`,
    title,
    priority: 'medium',
    status: 'To-do',
    dailyNotes: [],
    updatedAt: new Date().toISOString(),
  };
}

describe('dedup', () => {
  describe('buildQueryTokens', () => {
    it('prioritizes proper nouns and removes stop words', () => {
      const tokens = buildQueryTokens('Review Acme Corp API and the backend');
      assert.ok(tokens.length <= 12);
      assert.ok(tokens.includes('acme'));
      assert.ok(tokens.includes('corp'));
      assert.ok(tokens.includes('api'));
      assert.ok(tokens.includes('backend'));
      assert.ok(!tokens.includes('the'));
      assert.ok(!tokens.includes('and'));
    });

    it('dedupes and caps at 12', () => {
      const tokens = buildQueryTokens(
        'Task Task Task One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve',
      );
      assert.ok(tokens.length <= 12);
    });

    it('filters short tokens and stop words', () => {
      const tokens = buildQueryTokens('a to the on in');
      assert.equal(tokens.length, 0);
    });
  });

  describe('reconcileMcpIdsToSnapshot', () => {
    it('returns only tasks that exist in snapshot', () => {
      const tasksById: Record<string, NotionTaskPage> = {
        id1: task('id1', 'Task One'),
        id2: task('id2', 'Task Two'),
      };
      const result = reconcileMcpIdsToSnapshot(
        ['id1', 'id99', 'id2'],
        tasksById,
      );
      assert.equal(result.length, 2);
      assert.equal(result[0].id, 'id1');
      assert.equal(result[1].id, 'id2');
    });

    it('returns empty when no ids in snapshot', () => {
      const tasksById: Record<string, NotionTaskPage> = {};
      const result = reconcileMcpIdsToSnapshot(['id1', 'id2'], tasksById);
      assert.equal(result.length, 0);
    });
  });

  describe('dedupDraft', () => {
    it('returns create when no candidates', () => {
      const draft: DraftTask = { name: 'New Task Alpha' };
      const result = dedupDraft(draft, {});
      assert.equal(result.action, 'create');
      assert.equal(result.reason, 'no_match');
    });

    it('returns update for exact title match', () => {
      const tasksById: Record<string, NotionTaskPage> = {
        id1: task('id1', 'Ship API'),
      };
      const result = dedupDraft({ name: 'Ship API' }, tasksById);
      assert.equal(result.action, 'update');
      assert.equal(result.matchedTaskId, 'id1');
      assert.equal(result.reason, 'exact_match');
    });

    it('returns skip for multiple candidates without exact match', () => {
      const tasksById: Record<string, NotionTaskPage> = {
        id1: task('id1', 'Review API'),
        id2: task('id2', 'Review Backend'),
      };
      const result = dedupDraft({ name: 'Review API Backend' }, tasksById);
      assert.equal(result.action, 'skip');
      assert.equal(result.reason, 'multiple_candidates');
    });

    it('returns create when single fuzzy match', () => {
      const tasksById: Record<string, NotionTaskPage> = {
        id1: task('id1', 'Ship the API'),
      };
      // "Ship API" fuzzy-matches one task but is not exact → create (single_fuzzy_create)
      const result = dedupDraft({ name: 'Ship API' }, tasksById);
      assert.equal(result.action, 'create');
      assert.equal(result.matchedTaskId, 'id1');
      assert.equal(result.reason, 'single_fuzzy_create');
    });
  });

  describe('runDedupGate', () => {
    it('returns one result per draft in order', () => {
      const drafts: DraftTask[] = [{ name: 'New One' }, { name: 'Existing' }];
      const tasksById: Record<string, NotionTaskPage> = {
        id1: task('id1', 'Existing'),
      };
      const results = runDedupGate(drafts, tasksById);
      assert.equal(results.length, 2);
      assert.equal(results[0].action, 'create');
      assert.equal(results[1].action, 'update');
      assert.equal(results[1].matchedTaskId, 'id1');
    });
  });
});
