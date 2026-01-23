/**
 * Onboarding flow coordinator and state machine.
 * Manages the onboarding flow state and transitions.
 */

import { useReducer, useEffect } from 'react';
import { Stack, Text } from 'tamagui';
import type { OnboardingState } from '@flwst/types';
import type {
  OnboardingFlowState,
  OnboardingFlowAction,
  OnboardingStep,
} from './types';
import { getDefaultOnboardingState } from '@flwst/types';
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
      return 'Done';
    case 'Done':
      return 'Done';
    default:
      return currentStep;
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

  // Load initial state from IPC on mount
  useEffect(() => {
    const loadState = async (): Promise<void> => {
      try {
        const state = await window.api.onboarding.getState();
        if (state) {
          dispatch({ type: 'UPDATE_STATE', payload: state });
        }
      } catch (error) {
        // If state doesn't exist, use default
        console.error('Failed to load onboarding state:', error);
      }
    };
    loadState();
  }, []);

  // Persist state changes to main process
  useEffect(() => {
    const persistState = async (): Promise<void> => {
      try {
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
  }, [flowState.onboardingState, flowState.step]);

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

  // Render appropriate screen based on step
  switch (flowState.step) {
    case 'Welcome':
      return (
        <WelcomeScreen
          onNext={() => dispatch({ type: 'NEXT' })}
        />
      );

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
            // State is already updated by the IPC handler with DB IDs and status='ready'
            // Just mark onboarding as complete and advance
            dispatch({
              type: 'UPDATE_STATE',
              payload: {
                onboardingCompleted: true,
              },
            });
            dispatch({ type: 'NEXT' });
          }}
          onBack={() => dispatch({ type: 'BACK' })}
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
          <Text fontSize='$8' fontWeight='bold' textAlign='center'>
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
}
