/**
 * Telemetry redaction: allowlist-based filter so only safe metadata is sent
 * to Sentry, Amplitude, or other external sinks.
 *
 * Rule: telemetry must be metadata-only (no transcripts, prompts, OAuth tokens,
 * Notion IDs, file paths). Use redactForTelemetry() before forwarding to any
 * external logger or analytics.
 */

/**
 * Allowlist of property names safe to include in telemetry.
 * Add new keys here when introducing new event properties that are
 * known-safe (e.g. step names, boolean flags, counts).
 */
const TELEMETRY_ALLOWED_KEYS = new Set<string>([
  'step',
  'track',
  'llmSuccess',
  'llmDurationMs',
  'system',
  'teamSize',
  'urgency',
  'errorCategory',
]);

/**
 * Types of values we allow through (primitives only; no objects/arrays that
 * might contain nested sensitive data).
 */
function isSafeValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Redact metadata for telemetry: return a copy containing only allowlisted
 * keys whose values are string, number, or boolean. All other keys and
 * non-primitive values are stripped.
 *
 * @param metadata - Raw metadata (may contain sensitive data)
 * @returns Copy safe to send to Sentry, Amplitude, etc.
 */
export function redactForTelemetry(
  metadata: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (metadata == null || typeof metadata !== 'object') {
    return {};
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (TELEMETRY_ALLOWED_KEYS.has(key) && isSafeValue(value)) {
      out[key] = value;
    }
  }
  return out;
}
