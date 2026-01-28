/**
 * Unit tests for Notion schema validation and migration detection.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { detectStatusPropertyMigration } from './schemaValidation';
import type { NotionPropertyEntry } from './dataSources';

describe('schemaValidation helpers', () => {
  describe('detectStatusPropertyMigration', () => {
    it('detects migration needed when Status is select type', () => {
      const schema: NotionPropertyEntry[] = [
        { key: 'Name', type: 'title' },
        { key: 'Status', type: 'select' },
        { key: 'Priority', type: 'select' },
      ];

      const result = detectStatusPropertyMigration(schema);

      assert.equal(result.needsMigration, true);
      assert.equal(result.hasBeenMigrated, false);
    });

    it('detects migration complete when Status is status type', () => {
      const schema: NotionPropertyEntry[] = [
        { key: 'Name', type: 'title' },
        { key: 'Status', type: 'status' },
        { key: 'Priority', type: 'select' },
      ];

      const result = detectStatusPropertyMigration(schema);

      assert.equal(result.needsMigration, false);
      assert.equal(result.hasBeenMigrated, true);
    });

    it('detects migration complete when Status missing but status-type property exists', () => {
      const schema: NotionPropertyEntry[] = [
        { key: 'Name', type: 'title' },
        { key: 'Workflow Status', type: 'status' },
        { key: 'Priority', type: 'select' },
      ];

      const result = detectStatusPropertyMigration(schema);

      assert.equal(result.needsMigration, false);
      assert.equal(result.hasBeenMigrated, true);
    });

    it('detects no migration needed when Status missing and no status-type property', () => {
      const schema: NotionPropertyEntry[] = [
        { key: 'Name', type: 'title' },
        { key: 'Priority', type: 'select' },
      ];

      const result = detectStatusPropertyMigration(schema);

      assert.equal(result.needsMigration, false);
      assert.equal(result.hasBeenMigrated, false);
    });

    it('handles empty schema', () => {
      const schema: NotionPropertyEntry[] = [];

      const result = detectStatusPropertyMigration(schema);

      assert.equal(result.needsMigration, false);
      assert.equal(result.hasBeenMigrated, false);
    });

    it('handles schema with only Status as select', () => {
      const schema: NotionPropertyEntry[] = [{ key: 'Status', type: 'select' }];

      const result = detectStatusPropertyMigration(schema);

      assert.equal(result.needsMigration, true);
      assert.equal(result.hasBeenMigrated, false);
    });

    it('handles schema with only Status as status type', () => {
      const schema: NotionPropertyEntry[] = [{ key: 'Status', type: 'status' }];

      const result = detectStatusPropertyMigration(schema);

      assert.equal(result.needsMigration, false);
      assert.equal(result.hasBeenMigrated, true);
    });

    it('handles case-insensitive Status property name (exact match required)', () => {
      // The function uses exact match for 'Status', so lowercase won't match
      const schema: NotionPropertyEntry[] = [
        { key: 'status', type: 'select' }, // lowercase
        { key: 'STATUS', type: 'select' }, // uppercase
      ];

      const result = detectStatusPropertyMigration(schema);

      // Neither matches 'Status' exactly, so no migration needed
      assert.equal(result.needsMigration, false);
      assert.equal(result.hasBeenMigrated, false);
    });

    it('handles multiple status-type properties', () => {
      const schema: NotionPropertyEntry[] = [
        { key: 'Name', type: 'title' },
        { key: 'Status', type: 'select' },
        { key: 'Workflow Status', type: 'status' },
        { key: 'Another Status', type: 'status' },
      ];

      const result = detectStatusPropertyMigration(schema);

      // Status is still select, so migration needed
      assert.equal(result.needsMigration, true);
      // But status-type properties exist, so migration has been done (user renamed)
      assert.equal(result.hasBeenMigrated, true);
    });
  });
});
