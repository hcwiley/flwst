/**
 * Unit tests for Notion schema helpers.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildDailyNotesDbProperties,
  buildTasksDbProperties,
  normalizeNotionId,
} from './notionSchema';

describe('notionSchema helpers', () => {
  it('normalizes Notion IDs into hyphenated form', () => {
    const normalized = normalizeNotionId('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(normalized, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('builds tasks properties with relations when provided', () => {
    const properties = buildTasksDbProperties(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );
    assert.ok(properties.Status);
    assert.ok(properties.Priority);
    assert.equal(
      properties['Daily Notes'].relation.database_id,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );
  });

  it('builds daily notes properties with relations when provided', () => {
    const properties = buildDailyNotesDbProperties(
      'cccccccccccccccccccccccccccccccc',
    );
    assert.equal(
      properties.Tasks.relation.database_id,
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    );
  });
});
