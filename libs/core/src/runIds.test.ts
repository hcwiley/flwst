/**
 * Unit tests for Run ID utilities.
 * Focus on deterministic UUID v4 mapping and validation behavior.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRunIdFromFilename,
  md5HashToUuidV4,
  validateRunId,
} from './runIds';

test('md5HashToUuidV4 maps known md5 to UUID v4', () => {
  const md5 = 'd41d8cd98f00b204e9800998ecf8427e';

  const uuid = md5HashToUuidV4(md5);

  assert.equal(uuid, 'd41d8cd9-8f00-4204-a980-0998ecf8427e');
});

test('md5HashToUuidV4 rejects invalid hashes', () => {
  assert.throws(
    () => md5HashToUuidV4('not-a-valid-hash'),
    /md5 hash must be a 32-char hex string/,
  );
});

test('createRunIdFromFilename is deterministic', () => {
  const timestamp = new Date('2025-01-01T00:00:00.000Z');

  const first = createRunIdFromFilename('Example File.txt', timestamp);
  const second = createRunIdFromFilename('Example File.txt', timestamp);

  assert.equal(first, second);
});

test('validateRunId accepts generated run ids', () => {
  const timestamp = new Date('2025-01-01T00:00:00.000Z');
  const runId = createRunIdFromFilename('Example File.txt', timestamp);

  assert.equal(validateRunId(runId), true);
});
