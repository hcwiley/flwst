/**
 * Amplitude integration configuration types.
 */

import type { AmplitudeConfig } from "@flwst/types";

/**
 * Amplitude integration configuration interface.
 */
export interface AmplitudeIntegrationConfig extends AmplitudeConfig {
  // Future: additional Amplitude-specific config
}

/**
 * Placeholder for Amplitude client initialization.
 * Phase 1: Types only, no implementation.
 */
export function initAmplitude(config: AmplitudeIntegrationConfig): void {
  // Future: Amplitude initialization will be implemented here
  // eslint-disable-next-line no-console
  console.log("Amplitude initialization placeholder", config);
}
