/**
 * Onboarding flow coordinator and state machine.
 * Manages the onboarding flow state and transitions.
 */

import { track } from '@flwst/integrations';
import { getDefaultOnboardingState } from '@flwst/types';
import { BusyScreen, ErrorScreen } from '@flwst/ui';
import { useReducer, useEffect, useRef, useState } from 'react';
import { Stack, Spinner, Text } from 'tamagui';

import { onboardingReducer, getResumeStep } from './onboardingReducer';
import { OnboardingStatusBar } from './OnboardingStatusBar';
import {
  WelcomeScreen,
  SystemSelectScreen,
  FeatureRequestScreen,
  FeatureRequestThankYouScreen,
  NotionExplainScreen,
  NotionOAuthStartScreen,
  NotionOAuthCompleteScreen,
  ParentSelectScreen,
  ConfirmCreateScreen,
  CreateResourcesScreen,
  StatusConversionScreen,
  CancelConfirmScreen,
} from './screens';
import type { OnboardingFlowProps } from './types';
import type { OnboardingFlowAction, OnboardingStep } from './types';

/**
 * Onboarding flow coordinator component.
 * Manages the onboarding state machine and renders the appropriate screen.
 */
export function OnboardingFlow({
  initialState,
  onComplete,
}: OnboardingFlowProps): React.JSX.Element {
  const [flowState, dispatch] = useReducer(onboardingReducer, {
    step: 'Welcome',
    onboardingState: initialState || getDefaultOnboardingState(),
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const prevStepRef = useRef<OnboardingStep>(flowState.step);
  const userNavigatedToDoneRef = useRef(false);
  const hasCalledOnCompleteForHydratedDoneRef = useRef(false);

  const dispatchWithNavTracking = useRef((action: OnboardingFlowAction) => {
    if (action.type === 'NEXT') {
      userNavigatedToDoneRef.current = true;
    }
    dispatch(action);
  }).current;

  /**
   * Ordered onboarding steps used for progress tracking.
   * We keep distinct tracks to avoid large jumps when branching.
   */
  const notionStepOrder: OnboardingStep[] = [
    'Welcome',
    'SystemSelect',
    'NotionExplain',
    'NotionOAuthStart',
    'NotionOAuthComplete',
    'ParentSelect',
    'ConfirmCreate',
    'CreateResources',
    'StatusConversion',
    'Done',
  ];
  const requestStepOrder: OnboardingStep[] = [
    'Welcome',
    'SystemSelect',
    'FeatureRequest',
    'FeatureRequestThankYou',
  ];
  const isRequestFlow =
    flowState.step === 'FeatureRequest' ||
    flowState.step === 'FeatureRequestThankYou';
  const stepOrder = isRequestFlow ? requestStepOrder : notionStepOrder;

  /**
   * Normalize transient steps into a stable progress step.
   * This keeps the status bar consistent during busy/error screens.
   */
  const progressStep: OnboardingStep = (() => {
    switch (flowState.step) {
      case 'Busy':
        return flowState.busy?.returnToStep ?? 'Welcome';
      case 'Error':
        return flowState.error?.returnToStep ?? 'Welcome';
      case 'CancelConfirm':
        return 'Welcome';
      default:
        return flowState.step;
    }
  })();

  const stepIndex = Math.max(0, stepOrder.indexOf(progressStep));
  const totalSteps = stepOrder.length;
  const percentComplete =
    totalSteps <= 1 ? 100 : Math.round((stepIndex / (totalSteps - 1)) * 100);

  // Load initial state from IPC on mount
  useEffect(() => {
    const loadState = async (): Promise<void> => {
      try {
        const state = await window.api.onboarding.getState();
        if (state) {
          const resumeStep = getResumeStep(state);
          dispatch({ type: 'HYDRATE', payload: { state, step: resumeStep } });
        }
      } catch (error) {
        // If state doesn't exist, use default
        console.error('Failed to load onboarding state:', error);
      } finally {
        setIsHydrated(true);
      }
    };
    loadState();
  }, []);

  // Listen for push events from main process when onboarding state changes
  useEffect(() => {
    const handleStateChanged = async (): Promise<void> => {
      try {
        // Re-fetch state from main and rehydrate
        const latestState = await window.api.onboarding.getState();
        const resumeStep = getResumeStep(latestState);

        dispatch({
          type: 'HYDRATE',
          payload: { state: latestState, step: resumeStep },
        });
      } catch (error) {
        console.error(
          'Failed to refresh onboarding state after push event:',
          error,
        );
      }
    };

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on(
        'onboarding:stateChanged',
        handleStateChanged,
      );

      return () => {
        window.electron.ipcRenderer.removeListener(
          'onboarding:stateChanged',
          handleStateChanged,
        );
      };
    }
    return undefined;
  }, []);

  // Persist state changes to main process
  useEffect(() => {
    const persistState = async (): Promise<void> => {
      try {
        if (!isHydrated) {
          return;
        }
        await window.api.onboarding.updateState(flowState.onboardingState);
      } catch (error) {
        console.error('Failed to persist onboarding state:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: {
            returnToStep: flowState.step,
            safeMessage: 'Failed to save progress. Please try again.',
            debugCode: 'PERSIST_ERROR',
          },
        });
      }
    };
    persistState();
  }, [flowState.onboardingState, flowState.step, isHydrated]);

  // After hydrate, record current step so we don't track it as "viewed" (it came from storage).
  useEffect(() => {
    if (isHydrated) {
      prevStepRef.current = flowState.step;
    }
  }, [isHydrated, flowState.step]);

  // Analytics: step viewed only when step changes after hydrate (user navigated).
  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (flowState.step === prevStepRef.current) {
      return;
    }
    prevStepRef.current = flowState.step;
    track('Onboarding Step Viewed', { step: flowState.step });
  }, [flowState.step, isHydrated]);

  // Handle completion: track only when user navigated to Done; when hydrated into Done, just call onComplete once.
  useEffect(() => {
    if (flowState.step !== 'Done') {
      return;
    }
    if (userNavigatedToDoneRef.current) {
      const trackCompleted =
        flowState.onboardingState.notion.status === 'ready'
          ? 'notion'
          : (flowState.onboardingState.featureRequests?.length ?? 0) > 0
            ? 'feature_request'
            : 'notion';
      track('Onboarding Completed', { track: trackCompleted });
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }
    if (!hasCalledOnCompleteForHydratedDoneRef.current) {
      hasCalledOnCompleteForHydratedDoneRef.current = true;
      onComplete();
    }
    return undefined;
  }, [flowState.step, flowState.onboardingState, onComplete]);

  // In-flow loading until state is hydrated; avoid flashing Welcome or Done before we know the real step.
  if (!isHydrated) {
    return (
      <Stack
        flex={1}
        backgroundColor='$background'
        alignItems='center'
        justifyContent='center'
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
    );
  }

  // Hydrated into Done: no UI, completion effect will call onComplete().
  if (flowState.step === 'Done' && !userNavigatedToDoneRef.current) {
    return (
      <Stack
        flex={1}
        backgroundColor='$background'
        alignItems='center'
        justifyContent='center'
      >
        <Spinner size='large' />
      </Stack>
    );
  }

  /**
   * Render appropriate screen based on current step.
   * Wrapped with the shared footer status bar for visibility.
   */
  const renderStep = (): React.JSX.Element => {
    switch (flowState.step) {
      case 'Welcome':
        return (
          <WelcomeScreen
            onNext={() => dispatchWithNavTracking({ type: 'NEXT' })}
          />
        );

      case 'SystemSelect':
        return (
          <SystemSelectScreen
            onSelect={(system) =>
              dispatchWithNavTracking({ type: 'SELECT_SYSTEM', system })
            }
          />
        );

      case 'FeatureRequest': {
        const system =
          flowState.onboardingState.featureRequests?.[0]?.system === 'JIRA'
            ? 'jira'
            : 'other';
        return (
          <FeatureRequestScreen
            system={system}
            onSubmit={(payload) => {
              dispatchWithNavTracking({
                type: 'SUBMIT_FEATURE_REQUEST',
                payload,
              });
              const first = payload?.[0];
              if (first) {
                track('Feature Request Submitted', {
                  system: first.system,
                  teamSize: first.teamSize,
                  urgency: first.urgency,
                });
              }
            }}
            onBack={() => dispatchWithNavTracking({ type: 'BACK' })}
          />
        );
      }

      case 'FeatureRequestThankYou':
        return (
          <FeatureRequestThankYouScreen
            onContinue={() => dispatchWithNavTracking({ type: 'NEXT' })}
          />
        );

      case 'NotionExplain':
        return (
          <NotionExplainScreen
            onNext={() => dispatchWithNavTracking({ type: 'NEXT' })}
            onBack={() => dispatchWithNavTracking({ type: 'BACK' })}
          />
        );

      case 'NotionOAuthStart':
        return (
          <NotionOAuthStartScreen
            onNext={() => dispatchWithNavTracking({ type: 'NEXT' })}
            onBack={() => dispatchWithNavTracking({ type: 'BACK' })}
          />
        );

      case 'NotionOAuthComplete':
        return (
          <NotionOAuthCompleteScreen
            onNext={() => dispatchWithNavTracking({ type: 'NEXT' })}
            onBack={() => dispatchWithNavTracking({ type: 'BACK' })}
          />
        );

      case 'ParentSelect':
        return (
          <ParentSelectScreen
            onNext={async (parentPageId) => {
              await window.api.notion.setParentPage(parentPageId);
              dispatch({
                type: 'UPDATE_STATE',
                payload: {
                  notion: {
                    ...flowState.onboardingState.notion,
                    parentPageId,
                    status: 'parent_selected',
                  },
                },
              });
              dispatchWithNavTracking({ type: 'NEXT' });
            }}
            onBack={() => dispatchWithNavTracking({ type: 'BACK' })}
          />
        );

      case 'ConfirmCreate':
        return (
          <ConfirmCreateScreen
            parentPageId={flowState.onboardingState.notion.parentPageId || ''}
            onConfirm={() => dispatchWithNavTracking({ type: 'NEXT' })}
            onBack={() => dispatchWithNavTracking({ type: 'BACK' })}
          />
        );

      case 'CreateResources':
        return (
          <CreateResourcesScreen
            parentPageId={flowState.onboardingState.notion.parentPageId || ''}
            onComplete={async () => {
              try {
                const latestState = await window.api.onboarding.getState();
                const resumeStep = getResumeStep(latestState);
                dispatch({
                  type: 'HYDRATE',
                  payload: { state: latestState, step: resumeStep },
                });
              } catch (error) {
                console.error('Failed to refresh onboarding state:', error);
                dispatchWithNavTracking({ type: 'NEXT' });
              }
            }}
            onBack={() => dispatchWithNavTracking({ type: 'BACK' })}
          />
        );

      case 'StatusConversion':
        return (
          <StatusConversionScreen
            onContinue={() => {
              // Mark onboarding as complete
              dispatch({
                type: 'UPDATE_STATE',
                payload: {
                  onboardingCompleted: true,
                },
              });
              dispatchWithNavTracking({ type: 'NEXT' });
            }}
          />
        );

      case 'Busy':
        return flowState.busy ? (
          <BusyScreen message={flowState.busy.message} />
        ) : (
          <WelcomeScreen
            onNext={() => dispatchWithNavTracking({ type: 'NEXT' })}
          />
        );

      case 'Error':
        return flowState.error ? (
          <ErrorScreen
            safeMessage={flowState.error.safeMessage}
            debugCode={flowState.error.debugCode}
            onRetry={() => dispatch({ type: 'CLEAR_ERROR' })}
            onCancel={() => dispatch({ type: 'CANCEL' })}
          />
        ) : (
          <WelcomeScreen
            onNext={() => dispatchWithNavTracking({ type: 'NEXT' })}
          />
        );

      case 'CancelConfirm':
        return (
          <CancelConfirmScreen
            onConfirm={() => dispatch({ type: 'CONFIRM_CANCEL' })}
            onCancel={() => dispatchWithNavTracking({ type: 'BACK' })}
          />
        );

      case 'Done':
        return (
          <Stack
            flexDirection='column'
            flex={1}
            padding='$6'
            alignItems='center'
            justifyContent='center'
          >
            <Text
              fontSize='$8'
              fontWeight='bold'
              textAlign='center'
            >
              Setup Complete!
            </Text>
          </Stack>
        );

      default: {
        const step: OnboardingStep = flowState.step;
        return (
          <Stack
            flexDirection='column'
            flex={1}
            padding='$6'
            alignItems='center'
            justifyContent='center'
          >
            <Text fontSize='$4'>Unknown step: {step}</Text>
          </Stack>
        );
      }
    }
  };

  return (
    <Stack
      flex={1}
      backgroundColor='$background'
    >
      <Stack flex={1}>{renderStep()}</Stack>
      <OnboardingStatusBar
        currentStep={flowState.step}
        progressStep={progressStep}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        percentComplete={percentComplete}
      />
    </Stack>
  );
}
