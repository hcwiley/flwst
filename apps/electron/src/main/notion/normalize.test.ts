/**
 * Unit tests for status/priority normalization.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { normalizeStatus, normalizePriority } from './normalize';

describe('normalize', () => {
  describe('normalizeStatus', () => {
    it('maps lowercase and variants to canonical status', () => {
      assert.equal(normalizeStatus('todo'), 'To-do');
      assert.equal(normalizeStatus('TODO'), 'To-do');
      assert.equal(normalizeStatus('  in progress  '), 'In progress');
      assert.equal(normalizeStatus('On Deck'), 'On Deck');
      assert.equal(normalizeStatus('done'), 'Done');
      assert.equal(normalizeStatus('blocked'), 'BLOCKED');
      assert.equal(normalizeStatus('cancelled'), 'Cancelled');
      assert.equal(normalizeStatus('canceled'), 'Cancelled');
      assert.equal(normalizeStatus('backlog'), 'Backlog');
    });

    it('returns undefined for empty or unknown', () => {
      assert.equal(normalizeStatus(''), undefined);
      assert.equal(normalizeStatus('   '), undefined);
      assert.equal(normalizeStatus('unknown'), undefined);
      assert.equal(normalizeStatus(undefined), undefined);
    });
  });

  describe('normalizePriority', () => {
    it('maps aliases to canonical priority', () => {
      assert.equal(normalizePriority('top'), 'urgent');
      assert.equal(normalizePriority('TOP'), 'urgent');
      assert.equal(normalizePriority('high'), 'high');
      assert.equal(normalizePriority('medium'), 'medium');
      assert.equal(normalizePriority('low'), 'low');
      assert.equal(normalizePriority('back burner'), 'low');
      assert.equal(normalizePriority('urgent'), 'urgent');
    });

    it('returns undefined for empty or unknown', () => {
      assert.equal(normalizePriority(''), undefined);
      assert.equal(normalizePriority(undefined), undefined);
      assert.equal(normalizePriority('critical'), undefined);
    });
  });
});
