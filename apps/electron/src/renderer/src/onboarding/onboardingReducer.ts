/**
 * Onboarding flow reducer and step helpers.
 * Pure state machine logic; used by OnboardingFlow and tests.
 */

import type { OnboardingState } from '@flwst/types';
import { getDefaultOnboardingState } from '@flwst/types';
import { getLogger } from '@flwst/core';

import type {
  OnboardingFlowState,
  OnboardingFlowAction,
  OnboardingStep,
} from './types';

const VERY_VERBOSE_LOGGING = false;

/**
 * Get next step based on current step and onboarding state.
 */
function getNextStep(
  currentStep: OnboardingStep,
  _state: OnboardingState,
): OnboardingStep {
  if (VERY_VERBOSE_LOGGING) {
    getLogger().debug('getNextStep', { currentStep, _state });
  }
  switch (currentStep) {
    case 'Welcome':
      return 'SystemSelect';
    case 'SystemSelect':
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
 * Determine the onboarding step to resume from stored state.
 */
export function getResumeStep(state: OnboardingState): OnboardingStep {
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
 * Onboarding flow reducer.
 * Pure function that handles state transitions.
 */
export function onboardingReducer(
  state: OnboardingFlowState,
  action: OnboardingFlowAction,
): OnboardingFlowState {
  switch (action.type) {
    case 'NEXT': {
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
        return { ...state, step: 'NotionExplain' };
      }
      return { ...state, step: 'FeatureRequest' };
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
      return {
        ...state,
        onboardingState: updatedState,
        step: 'FeatureRequestThankYou',
      };
    }

    case 'SET_BUSY':
      return { ...state, step: 'Busy', busy: action.payload };

    case 'CLEAR_BUSY': {
      const returnStep = state.busy?.returnToStep || 'Welcome';
      return { ...state, step: returnStep, busy: undefined };
    }

    case 'SET_ERROR':
      return { ...state, step: 'Error', error: action.payload };

    case 'CLEAR_ERROR': {
      const returnStep = state.error?.returnToStep || 'Welcome';
      return { ...state, step: returnStep, error: undefined };
    }

    case 'CANCEL':
      return { ...state, step: 'CancelConfirm' };

    case 'CONFIRM_CANCEL':
      return { ...state, step: 'Done' };

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
      return { ...state, onboardingState: updatedState };
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
