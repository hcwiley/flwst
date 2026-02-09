/**
 * Amplitude integration: init and track with redacted event properties.
 * Used in the renderer only; all properties are passed through redactForTelemetry.
 */

import { redactForTelemetry } from '@flwst/core';
import type { AmplitudeConfig } from '@flwst/types';

/** Config for Amplitude init; extends AmplitudeConfig for future options. */
export type AmplitudeIntegrationConfig = AmplitudeConfig;

type AmplitudeModule = {
  init: (
    apiKey: string,
    userId?: string,
    options?: { defaultTracking?: boolean | Record<string, boolean> },
  ) => void;
  track: (eventName: string, properties?: Record<string, unknown>) => void;
};
let amplitudeModule: AmplitudeModule | null = null;
let initialized = false;

/**
 * Initialize the Amplitude SDK. No-ops if apiKey is missing.
 * Call once at renderer startup (e.g. in main.tsx after Sentry).
 */
export function initAmplitude(config: AmplitudeIntegrationConfig): void {
  const apiKey = config?.apiKey?.trim();
  if (!apiKey) {
    return;
  }
  import('@amplitude/analytics-browser').then((mod: AmplitudeModule) => {
    amplitudeModule = mod;
    mod.init(apiKey, config.userId, {
      defaultTracking: false,
    });
    initialized = true;
  });
}

/**
 * Track an event with optional properties. Properties are redacted before sending.
 * No-ops if Amplitude has not been initialized (e.g. no API key).
 */
export function track(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized || !amplitudeModule) {
    return;
  }
  const safe = redactForTelemetry(properties ?? {});
  amplitudeModule.track(eventName, safe as Record<string, unknown>);
}
