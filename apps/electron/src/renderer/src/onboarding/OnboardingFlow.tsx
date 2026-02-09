/**
 * Onboarding flow coordinator and state machine.
 * Manages the onboarding flow state and transitions.
 */

import { track } from '@flwst/integrations';
import { useReducer, useEffect, useRef, useState } from 'react';
import { Stack, Spinner, Text } from 'tamagui';
import type { OnboardingState } from '@flwst/types';
import type {
  OnboardingFlowState,
  OnboardingFlowAction,
  OnboardingStep,
} from './types';
import { getDefaultOnboardingState } from '@flwst/types';
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
import { BusyScreen, ErrorScreen } from '@flwst/ui';

/**
 * Onboarding flow reducer.
 * Pure function that handles state transitions.
 *
 * @internal - exported for testing
 */
export function onboardingReducer(
  state: OnboardingFlowState,
  action: OnboardingFlowAction,
): OnboardingFlowState {
  switch (action.type) {
    case 'NEXT': {
      // Determine next step based on current step and state
      const nextStep = getNextStep(state.step, state.onboardingState);
      return {
        ...state,
        step: nextStep,
        error: undefined,
      };
    }

    case 'BACK': {
      const prevStep = getPreviousStep(state.step);
      return {
        ...state,
        step: prevStep,
        error: undefined,
      };
    }

    case 'SELECT_SYSTEM': {
      if (action.system === 'notion') {
        return {
          ...state,
          step: 'NotionExplain',
        };
      }
      // JIRA or other -> FeatureRequest
      return {
        ...state,
        step: 'FeatureRequest',
      };
    }

    case 'SUBMIT_FEATURE_REQUEST': {
      const updatedState: OnboardingState = {
        ...state.onboardingState,
        featureRequests: [
          ...(state.onboardingState.featureRequests || []),
          ...(action.payload || []),
        ],
        updatedAt: new Date().toISOString(),
      };
      // After submitting feature request, show thank you screen
      // which will redirect back to system selection
      return {
        ...state,
        onboardingState: updatedState,
        step: 'FeatureRequestThankYou',
      };
    }

    case 'SET_BUSY':
      return {
        ...state,
        step: 'Busy',
        busy: action.payload,
      };

    case 'CLEAR_BUSY': {
      const returnStep = state.busy?.returnToStep || 'Welcome';
      return {
        ...state,
        step: returnStep,
        busy: undefined,
      };
    }

    case 'SET_ERROR':
      return {
        ...state,
        step: 'Error',
        error: action.payload,
      };

    case 'CLEAR_ERROR': {
      const returnStep = state.error?.returnToStep || 'Welcome';
      return {
        ...state,
        step: returnStep,
        error: undefined,
      };
    }

    case 'CANCEL':
      return {
        ...state,
        step: 'CancelConfirm',
      };

    case 'CONFIRM_CANCEL':
      return {
        ...state,
        step: 'Done',
      };

    case 'HYDRATE':
      return {
        ...state,
        step: action.payload.step,
        onboardingState: action.payload.state,
        busy: undefined,
        error: undefined,
      };

    case 'UPDATE_STATE': {
      const updatedState: OnboardingState = {
        ...state.onboardingState,
        ...action.payload,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...state,
        onboardingState: updatedState,
      };
    }

    case 'RESET':
      return {
        step: 'Welcome',
        onboardingState: getDefaultOnboardingState(),
      };

    default:
      return state;
  }
}

/**
 * Get next step based on current step and onboarding state.
 */
function getNextStep(
  currentStep: OnboardingStep,
  _state: OnboardingState,
): OnboardingStep {
  switch (currentStep) {
    case 'Welcome':
      return 'SystemSelect';
    case 'SystemSelect':
      // This should be handled by SELECT_SYSTEM action
      return 'SystemSelect';
    case 'FeatureRequestThankYou':
      return 'SystemSelect';
    case 'FeatureRequest':
      return 'FeatureRequestThankYou';
    case 'NotionExplain':
      return 'NotionOAuthStart';
    case 'NotionOAuthStart':
      return 'NotionOAuthComplete';
    case 'NotionOAuthComplete':
      return 'ParentSelect';
    case 'ParentSelect':
      return 'ConfirmCreate';
    case 'ConfirmCreate':
      return 'CreateResources';
    case 'CreateResources':
      return 'StatusConversion';
    case 'StatusConversion':
      return 'Done';
    case 'Done':
      return 'Done';
    default:
      return currentStep;
  }
}

/**
 * Determine the onboarding step to resume from stored state.
 */
function getResumeStep(state: OnboardingState): OnboardingStep {
  // Prefer the detected migration state from schema checks.
  const needsStatusMigration =
    state.notion.statusPropertyNeedsMigration === true &&
    state.notion.statusPropertyHasBeenMigrated !== true;

  if (needsStatusMigration) {
    return 'StatusConversion';
  }

  if (state.onboardingCompleted) {
    return 'Done';
  }

  switch (state.notion.status) {
    case 'ready':
      return 'Done';
    case 'resources_created':
      return state.onboardingCompleted ? 'Done' : 'StatusConversion';
    case 'parent_selected':
      return 'ConfirmCreate';
    case 'authed':
      return 'ParentSelect';
    case 'oauth_pending':
      return 'NotionOAuthComplete';
    case 'error':
      return 'NotionExplain';
    case 'disconnected':
    default:
      return 'Welcome';
  }
}

/**
 * Get previous step.
 */
function getPreviousStep(currentStep: OnboardingStep): OnboardingStep {
  switch (currentStep) {
    case 'SystemSelect':
      return 'Welcome';
    case 'FeatureRequest':
      return 'SystemSelect';
    case 'FeatureRequestThankYou':
      return 'FeatureRequest';
    case 'NotionExplain':
      return 'SystemSelect';
    case 'NotionOAuthStart':
      return 'NotionExplain';
    case 'NotionOAuthComplete':
      return 'NotionOAuthStart';
    case 'ParentSelect':
      return 'NotionOAuthComplete';
    case 'ConfirmCreate':
      return 'ParentSelect';
    case 'CreateResources':
      return 'ConfirmCreate';
    case 'StatusConversion':
      return 'CreateResources';
    default:
      return 'Welcome';
  }
}

/**
 * OnboardingFlow component props.
 */
export interface OnboardingFlowProps {
  initialState?: OnboardingState;
  onComplete: () => void;
}

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
  }, [isHydrated]);

  // Analytics: step viewed only when step changes after hydrate (user navigated).
  useEffect(() => {
    if (!isHydrated) return;
    if (flowState.step === prevStepRef.current) return;
    prevStepRef.current = flowState.step;
    track('Onboarding Step Viewed', { step: flowState.step });
  }, [flowState.step, isHydrated]);

  // Handle completion: track only when user navigated to Done; when hydrated into Done, just call onComplete once.
  useEffect(() => {
    if (flowState.step !== 'Done') return;
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
