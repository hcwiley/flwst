/**
 * Onboarding flow state machine types for renderer.
 */

import type { OnboardingState } from '@flwst/types';

/**
 * Onboarding step states.
 */
export type OnboardingStep =
  | 'Welcome'
  | 'SystemSelect'
  | 'FeatureRequest'
  | 'FeatureRequestThankYou'
  | 'NotionExplain'
  | 'NotionOAuthStart'
  | 'NotionOAuthComplete'
  | 'ParentSelect'
  | 'ConfirmCreate'
  | 'CreateResources'
  | 'Done'
  | 'CancelConfirm'
  | 'Error'
  | 'Busy';

/**
 * Busy state payload.
 */
export interface BusyState {
  returnToStep: OnboardingStep;
  message?: string;
}

/**
 * Error state payload.
 */
export interface ErrorState {
  returnToStep: OnboardingStep;
  safeMessage: string;
  debugCode?: string;
}

/**
 * Onboarding flow state.
 */
export interface OnboardingFlowState {
  step: OnboardingStep;
  onboardingState: OnboardingState;
  busy?: BusyState;
  error?: ErrorState;
}

/**
 * Onboarding flow actions.
 */
export type OnboardingFlowAction =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SELECT_SYSTEM'; system: 'notion' | 'jira' | 'other' }
  | { type: 'SUBMIT_FEATURE_REQUEST'; payload: OnboardingState['featureRequests'] }
  | { type: 'SET_BUSY'; payload: BusyState }
  | { type: 'CLEAR_BUSY' }
  | { type: 'SET_ERROR'; payload: ErrorState }
  | { type: 'CLEAR_ERROR' }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM_CANCEL' }
  | { type: 'UPDATE_STATE'; payload: Partial<OnboardingState> }
  | { type: 'RESET' };
