/**
 * Unit tests for telemetry redaction.
 * Ensures allowlist behavior and that non-safe keys/values are stripped.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { redactForTelemetry } from './redact';

test('redactForTelemetry returns empty object for null/undefined', () => {
  assert.deepEqual(redactForTelemetry(null), {});
  assert.deepEqual(redactForTelemetry(undefined), {});
});

test('redactForTelemetry keeps allowlisted keys with safe types', () => {
  const input = {
    step: 'Welcome',
    llmSuccess: true,
    llmDurationMs: 1234,
    system: 'notion',
    track: 'notion',
    teamSize: 'small',
    urgency: 'high',
  };
  const out = redactForTelemetry(input);
  assert.deepEqual(out, input);
});

test('redactForTelemetry strips non-allowlisted keys', () => {
  const input = {
    step: 'Welcome',
    runId: 'abc-123',
    notionPageId: 'secret-id',
    accessToken: 'token',
  };
  const out = redactForTelemetry(input);
  assert.deepEqual(out, { step: 'Welcome' });
});

test('redactForTelemetry strips allowlisted keys with non-safe values', () => {
  const input = {
    step: { nested: 'object' },
    llmSuccess: [1, 2, 3],
    system: null,
    track: undefined,
    llmDurationMs: 100,
  };
  const out = redactForTelemetry(input);
  assert.deepEqual(out, { llmDurationMs: 100 });
});

test('redactForTelemetry returns a copy', () => {
  const input = { step: 'Welcome' };
  const out = redactForTelemetry(input);
  assert.notStrictEqual(out, input);
  assert.deepEqual(out, input);
});

test('redactForTelemetry keeps appVersion for version tracking', () => {
  const input = { appVersion: '1.0.0', accessToken: 'secret' };
  const out = redactForTelemetry(input);
  assert.deepEqual(out, { appVersion: '1.0.0' });
});
