import { useState, useEffect } from 'react';
import { OnboardingLayout } from './onboarding/OnboardingLayout';
import { MainLayout } from './layouts/MainLayout';
import type { OnboardingState } from '@flwst/types';

/**
 * Determine if onboarding should be shown.
 * Gate: !onboardingCompleted || notion.status !== 'ready'
 */
function shouldShowOnboarding(state: OnboardingState): boolean {
  if (!state.onboardingCompleted) {
    return true;
  }
  if (state.notion.status !== 'ready') {
    return true;
  }
  return false;
}

function App(): React.JSX.Element {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async (): Promise<void> => {
      try {
        const state = await window.api.onboarding.getState();
        setShowOnboarding(shouldShowOnboarding(state));
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        // Default to showing onboarding on error
        setShowOnboarding(true);
      } finally {
        setIsLoading(false);
      }
    };
    checkOnboardingStatus();
  }, []);

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
    // Show loading state while checking onboarding status
    return <div>Loading...</div>;
  }

  if (showOnboarding) {
    return <OnboardingLayout onComplete={handleOnboardingComplete} />;
  }

  return <MainLayout />;
}

export default App;
