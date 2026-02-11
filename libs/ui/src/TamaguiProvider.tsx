/**
 * FlowState TamaguiProvider wrapper.
 * Uses the shared Tamagui config from tamagui.ts and provides the context.
 */

import type { ReactNode } from 'react';
import { TamaguiProvider as BaseTamaguiProvider } from 'tamagui';

import { tamaguiConfig } from './tamagui';

/**
 * FlowState TamaguiProvider component.
 * Wraps children with Tamagui context using the shared config.
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
  return (
    <BaseTamaguiProvider
      config={tamaguiConfig}
      defaultTheme={defaultTheme}
    >
      {children}
    </BaseTamaguiProvider>
  );
}
