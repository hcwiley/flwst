/**
 * FlowState TamaguiProvider wrapper.
 * Initializes Tamagui with createTamagui and provides the context.
 */

import { createTamagui, TamaguiProvider as BaseTamaguiProvider } from 'tamagui';
import { config } from '@tamagui/config/v3';
import type { ReactNode } from 'react';

/**
 * Initialize Tamagui with the config.
 * This should be called once before using Tamagui components.
 * The result of createTamagui is what should be passed to TamaguiProvider.
 */
let tamaguiConfig: ReturnType<typeof createTamagui> | null = null;

function getTamaguiConfig() {
  if (!tamaguiConfig) {
    tamaguiConfig = createTamagui(config);
  }
  return tamaguiConfig;
}

/**
 * FlowState TamaguiProvider component.
 * Wraps children with Tamagui context after initializing Tamagui.
 *
 * @param props - Provider props including children and theme
 */
export function FlowStateTamaguiProvider({
  children,
  defaultTheme = 'light',
}: {
  children: ReactNode;
  defaultTheme?: 'light' | 'dark';
}): React.JSX.Element {
  // Initialize Tamagui and get the config instance
  const tamaguiInstance = getTamaguiConfig();

  return (
    <BaseTamaguiProvider
      config={tamaguiInstance}
      defaultTheme={defaultTheme}
    >
      {children}
    </BaseTamaguiProvider>
  );
}
