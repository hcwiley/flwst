/**
 * Onboarding layout component.
 * Wraps the onboarding flow with minimal UI.
 */

import { Stack } from 'tamagui';
import { FlowStateTamaguiProvider } from '@flwst/ui';
import { OnboardingFlow } from './OnboardingFlow';

export interface OnboardingLayoutProps {
  onComplete: () => void;
}

export function OnboardingLayout({
  onComplete,
}: OnboardingLayoutProps): React.JSX.Element {
  return (
    <FlowStateTamaguiProvider defaultTheme='light'>
      <Stack
        flexDirection='row'
        height='100vh'
        width='100vw'
      >
        <Stack
          flex={1}
          backgroundColor='$background'
        >
          <OnboardingFlow onComplete={onComplete} />
        </Stack>
      </Stack>
    </FlowStateTamaguiProvider>
  );
}
