/**
 * Onboarding flow coordinator and state machine.
 * Manages the onboarding flow state and transitions.
 */

import { useReducer, useEffect, useState } from 'react';
import { Stack, Text } from 'tamagui';
import type { OnboardingState } from '@flwst/types';
import type {
  OnboardingFlowState,
  OnboardingFlowAction,
  OnboardingStep,
} from './types';
import { getLogger } from '../../sentry';
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
  BusyScreen,
  ErrorScreen,
  CancelConfirmScreen,
} from './screens';

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
  const logger = getLogger();
  const [flowState, dispatch] = useReducer(onboardingReducer, {
    step: 'Welcome',
    onboardingState: initialState || getDefaultOnboardingState(),
  });
  const [isHydrated, setIsHydrated] = useState(false);

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
          // DEBUG: notion-onboarding
          logger.debug('notion-onboarding', {
            sessionId: 'debug-session',
            runId: 'pre',
            hypothesisId: 'H11',
            location: 'OnboardingFlow.tsx:loadState',
            message: 'loaded onboarding state from main',
            data: {
              resumeStep,
              notionStatus: state.notion?.status,
              hasParentPageId: !!state.notion?.parentPageId,
              hasWorkspaceId: !!state.notion?.workspace?.workspaceId,
              onboardingCompleted: !!state.onboardingCompleted,
              needsMigration: state.notion?.statusPropertyNeedsMigration,
              hasBeenMigrated: state.notion?.statusPropertyHasBeenMigrated,
            },
            timestamp: Date.now(),
          });
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
        // DEBUG: notion-onboarding
        logger.debug('notion-onboarding', {
          sessionId: 'debug-session',
          runId: 'pre',
          hypothesisId: 'H13',
          location: 'OnboardingFlow.tsx:handleStateChanged',
          message: 'received onboarding state changed event from main',
          timestamp: Date.now(),
        });

        // Re-fetch state from main and rehydrate
        const latestState = await window.api.onboarding.getState();
        const resumeStep = getResumeStep(latestState);

        // DEBUG: notion-onboarding
        logger.debug('notion-onboarding', {
          sessionId: 'debug-session',
          runId: 'pre',
          hypothesisId: 'H13',
          location: 'OnboardingFlow.tsx:handleStateChanged:rehydrate',
          message: 'rehydrating onboarding state after push event',
          data: {
            resumeStep,
            notionStatus: latestState.notion?.status,
            needsMigration: latestState.notion?.statusPropertyNeedsMigration,
            hasBeenMigrated: latestState.notion?.statusPropertyHasBeenMigrated,
            onboardingCompleted: !!latestState.onboardingCompleted,
          },
          timestamp: Date.now(),
        });

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
          // DEBUG: notion-onboarding
          logger.debug('notion-onboarding', {
            sessionId: 'debug-session',
            runId: 'pre',
            hypothesisId: 'H11',
            location: 'OnboardingFlow.tsx:persistState:skip',
            message: 'skipping persist before hydration',
            data: {
              step: flowState.step,
              notionStatus: flowState.onboardingState.notion?.status,
            },
            timestamp: Date.now(),
          });
          return;
        }
        // DEBUG: notion-onboarding
        logger.debug('notion-onboarding', {
          sessionId: 'debug-session',
          runId: 'pre',
          hypothesisId: 'H11',
          location: 'OnboardingFlow.tsx:persistState',
          message: 'persisting onboarding state from renderer',
          data: {
            step: flowState.step,
            notionStatus: flowState.onboardingState.notion?.status,
            hasParentPageId: !!flowState.onboardingState.notion?.parentPageId,
            hasWorkspaceId:
              !!flowState.onboardingState.notion?.workspace?.workspaceId,
            onboardingCompleted:
              !!flowState.onboardingState.onboardingCompleted,
          },
          timestamp: Date.now(),
        });
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

  // Handle completion
  useEffect(() => {
    if (flowState.step === 'Done') {
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [flowState.step, onComplete]);

  /**
   * Render appropriate screen based on current step.
   * Wrapped with the shared footer status bar for visibility.
   */
  const renderStep = (): React.JSX.Element => {
    switch (flowState.step) {
      case 'Welcome':
        return <WelcomeScreen onNext={() => dispatch({ type: 'NEXT' })} />;

      case 'SystemSelect':
        return (
          <SystemSelectScreen
            onSelect={(system) => dispatch({ type: 'SELECT_SYSTEM', system })}
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
            onSubmit={(payload) =>
              dispatch({ type: 'SUBMIT_FEATURE_REQUEST', payload })
            }
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );
      }

      case 'FeatureRequestThankYou':
        return (
          <FeatureRequestThankYouScreen
            onContinue={() => dispatch({ type: 'NEXT' })}
          />
        );

      case 'NotionExplain':
        return (
          <NotionExplainScreen
            onNext={() => dispatch({ type: 'NEXT' })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );

      case 'NotionOAuthStart':
        return (
          <NotionOAuthStartScreen
            onNext={() => dispatch({ type: 'NEXT' })}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );

      case 'NotionOAuthComplete':
        return (
          <NotionOAuthCompleteScreen
            onNext={() => dispatch({ type: 'NEXT' })}
            onBack={() => dispatch({ type: 'BACK' })}
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
              dispatch({ type: 'NEXT' });
            }}
            onBack={() => dispatch({ type: 'BACK' })}
          />
        );

      case 'ConfirmCreate':
        return (
          <ConfirmCreateScreen
            parentPageId={flowState.onboardingState.notion.parentPageId || ''}
            onConfirm={() => dispatch({ type: 'NEXT' })}
            onBack={() => dispatch({ type: 'BACK' })}
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
                dispatch({ type: 'NEXT' });
              }
            }}
            onBack={() => dispatch({ type: 'BACK' })}
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
              dispatch({ type: 'NEXT' });
            }}
          />
        );

      case 'Busy':
        return flowState.busy ? (
          <BusyScreen busy={flowState.busy} />
        ) : (
          <WelcomeScreen onNext={() => dispatch({ type: 'NEXT' })} />
        );

      case 'Error':
        return flowState.error ? (
          <ErrorScreen
            error={flowState.error}
            onRetry={() => dispatch({ type: 'CLEAR_ERROR' })}
            onCancel={() => dispatch({ type: 'CANCEL' })}
          />
        ) : (
          <WelcomeScreen onNext={() => dispatch({ type: 'NEXT' })} />
        );

      case 'CancelConfirm':
        return (
          <CancelConfirmScreen
            onConfirm={() => dispatch({ type: 'CONFIRM_CANCEL' })}
            onCancel={() => dispatch({ type: 'BACK' })}
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
