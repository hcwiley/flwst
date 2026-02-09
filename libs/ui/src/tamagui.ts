/**
 * Tamagui base configuration for FlowState.
 * Uses @tamagui/config v3 and createTamagui; exports type and singleton instance.
 *
 * Note: Tamagui is a direct dependency of @flwst/ui.
 * Apps get the provider via FlowStateTamaguiProvider from this package.
 */

import { config } from '@tamagui/config/v3';
import { createTamagui } from 'tamagui';

/** Tamagui config type (return type of createTamagui). */
export type TamaguiConfig = ReturnType<typeof createTamagui>;

/**
 * FlowState custom theme tokens.
 * Extend or override Tamagui tokens here when needed.
 */
export const flowStateTokens = {
  // Custom tokens can be added for FlowState-specific theming
};

/**
 * FlowState Tamagui configuration instance.
 * Built from @tamagui/config/v3; used by FlowStateTamaguiProvider.
 */
export const tamaguiConfig: TamaguiConfig = createTamagui(config);
