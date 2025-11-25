import { TamaguiProvider, Theme } from 'tamagui';
import config from './tamagui.config';

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <TamaguiProvider config={config}>
      <Theme name="light">{children}</Theme>
    </TamaguiProvider>
  );
}
