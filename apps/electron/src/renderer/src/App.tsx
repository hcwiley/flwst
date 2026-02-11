import { useState, useEffect } from 'react';
import { Stack, Spinner, Text } from 'tamagui';
import { FlowStateTamaguiProvider } from '@flwst/ui';
import { OnboardingLayout } from './onboarding/OnboardingLayout';
import { MainLayout } from './layouts/MainLayout';
import { PreflightScreen } from './preflight/PreflightScreen';
import type { OnboardingState } from '@flwst/types';

/**
 * Determine if onboarding should be shown.
 * Gate: !onboardingCompleted || notion.status !== 'ready'
 */
function shouldShowOnboarding(state: OnboardingState): boolean {
  const needsStatusMigration =
    state.notion.statusPropertyNeedsMigration === true &&
    state.notion.statusPropertyHasBeenMigrated !== true;

  if (needsStatusMigration) {
    return true;
  }
  if (!state.onboardingCompleted) {
    return true;
  }
  if (state.notion.status !== 'ready') {
    return true;
  }
  return false;
}

function App(): React.JSX.Element {
  const [preflightCompleted, setPreflightCompleted] = useState<boolean | null>(
    null,
  );
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStartupStatus = async (): Promise<void> => {
      try {
        // First check if preflight is completed
        const preflightDone = await window.api.preflight.isCompleted();
        setPreflightCompleted(preflightDone);

        if (preflightDone) {
          // Only check onboarding if preflight is done (storage is initialized)
          const state = await window.api.onboarding.getState();
          setShowOnboarding(shouldShowOnboarding(state));
        }
      } catch (error) {
        console.error('Failed to check startup status:', error);
        // If preflight check fails, assume it needs to be done
        setPreflightCompleted(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkStartupStatus();
  }, []);

  const handlePreflightComplete = async (): Promise<void> => {
    // After preflight, check onboarding status
    setPreflightCompleted(true);
    try {
      const state = await window.api.onboarding.getState();
      setShowOnboarding(shouldShowOnboarding(state));
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = async (): Promise<void> => {
    // Update state to mark onboarding as complete
    try {
      const state = await window.api.onboarding.getState();
      await window.api.onboarding.updateState({
        ...state,
        onboardingCompleted: true,
      });
      setShowOnboarding(false);
    } catch (error) {
      console.error('Failed to mark onboarding as complete:', error);
    }
  };

  if (isLoading) {
    return (
      <FlowStateTamaguiProvider defaultTheme='light'>
        <Stack
          flex={1}
          height='100vh'
          width='100vw'
          alignItems='center'
          justifyContent='center'
          backgroundColor='$background'
          gap='$3'
        >
          <Spinner size='large' />
          <Text
            fontSize='$4'
            color='$gray11'
          >
            Loading…
          </Text>
        </Stack>
      </FlowStateTamaguiProvider>
    );
  }

  // Show preflight screen if not completed
  if (preflightCompleted === false) {
    return (
      <FlowStateTamaguiProvider defaultTheme='light'>
        <PreflightScreen onComplete={handlePreflightComplete} />
      </FlowStateTamaguiProvider>
    );
  }

  if (showOnboarding) {
    return <OnboardingLayout onComplete={handleOnboardingComplete} />;
  }

  return <MainLayout />;
}

export default App;
