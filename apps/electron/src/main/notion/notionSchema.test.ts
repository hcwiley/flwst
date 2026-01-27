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

  it('normalizes Notion IDs from slug input', () => {
    const normalized = normalizeNotionId(
      'flwst-DEMO-2a3f192d8082806994c6cce9e70525a7',
    );
    assert.equal(normalized, '2a3f192d-8082-8069-94c6-cce9e70525a7');
  });

  it('normalizes Notion IDs from full URL input', () => {
    const normalized = normalizeNotionId(
      'https://www.notion.so/hcwiley/flwst-DEMO-2a3f192d8082806994c6cce9e70525a7?source=copy_link',
    );
    assert.equal(normalized, '2a3f192d-8082-8069-94c6-cce9e70525a7');
  });

  it('builds tasks properties with relations when provided', () => {
    const properties: any = buildTasksDbProperties(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );
    assert.ok(properties.Status);
    assert.ok(properties.Priority);
    assert.equal(
      properties['Daily Notes'].relation.data_source_id,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );
    assert.equal(properties['Daily Notes'].relation.type, 'single_property');
  });

  it('builds daily notes properties with relations when provided', () => {
    const properties: any = buildDailyNotesDbProperties(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    );
    assert.equal(
      properties.Tasks.relation.data_source_id,
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    );
    assert.equal(properties.Tasks.relation.type, 'single_property');
  });
});
