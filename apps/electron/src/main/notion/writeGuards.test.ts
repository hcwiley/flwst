/**
 * Unit tests for write guards: assignee normalization and safe payloads.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  normalizeNotionUserId,
  maybeAddAssignee,
  type NotionWriteProps,
} from './writeGuards';

describe('writeGuards', () => {
  describe('normalizeNotionUserId', () => {
    it('accepts 32 hex chars without hyphens', () => {
      const id = 'a'.repeat(32);
      assert.equal(normalizeNotionUserId(id), id);
    });

    it('accepts hyphenated UUID and returns without hyphens', () => {
      const withHyphens = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const expected = 'aaaaaaaabbbbccccddddeeeeeeeeeeee';
      assert.equal(normalizeNotionUserId(withHyphens), expected);
    });

    it('returns undefined for invalid', () => {
      assert.equal(normalizeNotionUserId(''), undefined);
      assert.equal(normalizeNotionUserId('short'), undefined);
      assert.equal(normalizeNotionUserId('x'.repeat(33)), undefined);
      assert.equal(normalizeNotionUserId('g'.repeat(32)), undefined);
      assert.equal(normalizeNotionUserId(undefined), undefined);
    });

    it('trims whitespace', () => {
      const id = 'a'.repeat(32);
      assert.equal(normalizeNotionUserId(`  ${id}  `), id);
    });
  });

  describe('maybeAddAssignee', () => {
    it('adds Assignee when valid id', () => {
      const props: NotionWriteProps = {};
      const validId = 'a'.repeat(32);
      maybeAddAssignee(props, validId);
      assert.deepEqual(props.Assignee, { people: [{ id: validId }] });
    });

    it('does not add Assignee when undefined', () => {
      const props: NotionWriteProps = {};
      maybeAddAssignee(props, undefined);
      assert.equal(props.Assignee, undefined);
    });

    it('does not add Assignee when invalid', () => {
      const props: NotionWriteProps = {};
      maybeAddAssignee(props, 'not-valid');
      assert.equal(props.Assignee, undefined);
    });
  });
});
