/**
 * Unit tests for onboarding flow reducer and state machine logic.
 */

import type { OnboardingState } from '@flwst/types';
import { getDefaultOnboardingState } from '@flwst/types';
import { strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { onboardingReducer } from './onboardingReducer';
import type { OnboardingFlowState, OnboardingFlowAction } from './types';

/**
 * Create initial flow state for testing.
 */
function createInitialState(
  step: OnboardingFlowState['step'] = 'Welcome',
  onboardingState?: Partial<OnboardingState>,
): OnboardingFlowState {
  return {
    step,
    onboardingState: {
      ...getDefaultOnboardingState(),
      ...onboardingState,
    },
  };
}

describe('onboardingReducer', () => {
  describe('NEXT action', () => {
    it('should advance from Welcome to SystemSelect', () => {
      const state = createInitialState('Welcome');
      const action: OnboardingFlowAction = { type: 'NEXT' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'SystemSelect');
    });

    it('should advance from NotionExplain to NotionOAuthStart', () => {
      const state = createInitialState('NotionExplain');
      const action: OnboardingFlowAction = { type: 'NEXT' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'NotionOAuthStart');
    });

    it('should clear error when advancing', () => {
      const state: OnboardingFlowState = {
        step: 'Welcome',
        onboardingState: getDefaultOnboardingState(),
        error: {
          returnToStep: 'Welcome',
          safeMessage: 'Test error',
        },
      };
      const action: OnboardingFlowAction = { type: 'NEXT' };
      const result = onboardingReducer(state, action);
      strictEqual(result.error, undefined);
    });
  });

  describe('BACK action', () => {
    it('should go back from SystemSelect to Welcome', () => {
      const state = createInitialState('SystemSelect');
      const action: OnboardingFlowAction = { type: 'BACK' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'Welcome');
    });

    it('should go back from NotionExplain to SystemSelect', () => {
      const state = createInitialState('NotionExplain');
      const action: OnboardingFlowAction = { type: 'BACK' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'SystemSelect');
    });

    it('should clear error when going back', () => {
      const state: OnboardingFlowState = {
        step: 'SystemSelect',
        onboardingState: getDefaultOnboardingState(),
        error: {
          returnToStep: 'SystemSelect',
          safeMessage: 'Test error',
        },
      };
      const action: OnboardingFlowAction = { type: 'BACK' };
      const result = onboardingReducer(state, action);
      strictEqual(result.error, undefined);
    });
  });

  describe('SELECT_SYSTEM action', () => {
    it('should go to NotionExplain when selecting notion', () => {
      const state = createInitialState('SystemSelect');
      const action: OnboardingFlowAction = {
        type: 'SELECT_SYSTEM',
        system: 'notion',
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'NotionExplain');
    });

    it('should go to FeatureRequest when selecting jira', () => {
      const state = createInitialState('SystemSelect');
      const action: OnboardingFlowAction = {
        type: 'SELECT_SYSTEM',
        system: 'jira',
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'FeatureRequest');
    });

    it('should go to FeatureRequest when selecting other', () => {
      const state = createInitialState('SystemSelect');
      const action: OnboardingFlowAction = {
        type: 'SELECT_SYSTEM',
        system: 'other',
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'FeatureRequest');
    });
  });

  describe('SUBMIT_FEATURE_REQUEST action', () => {
    it('should add feature request to state and go to thank you screen', () => {
      const state = createInitialState('FeatureRequest');
      const action: OnboardingFlowAction = {
        type: 'SUBMIT_FEATURE_REQUEST',
        payload: [
          {
            system: 'JIRA',
            notes: 'Test notes',
            teamSize: '5-10',
            urgency: 'High',
            submittedAt: new Date().toISOString(),
          },
        ],
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'FeatureRequestThankYou');
      strictEqual(result.onboardingState.featureRequests?.length, 1);
      strictEqual(result.onboardingState.featureRequests?.[0]?.system, 'JIRA');
    });

    it('should append to existing feature requests', () => {
      const state = createInitialState('FeatureRequest', {
        featureRequests: [
          {
            system: 'Other',
            submittedAt: new Date().toISOString(),
          },
        ],
      });
      const action: OnboardingFlowAction = {
        type: 'SUBMIT_FEATURE_REQUEST',
        payload: [
          {
            system: 'JIRA',
            submittedAt: new Date().toISOString(),
          },
        ],
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.onboardingState.featureRequests?.length, 2);
    });
  });

  describe('SET_BUSY action', () => {
    it('should set busy state', () => {
      const state = createInitialState('Welcome');
      const action: OnboardingFlowAction = {
        type: 'SET_BUSY',
        payload: {
          returnToStep: 'Welcome',
          message: 'Processing...',
        },
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'Busy');
      strictEqual(result.busy?.returnToStep, 'Welcome');
      strictEqual(result.busy?.message, 'Processing...');
    });
  });

  describe('CLEAR_BUSY action', () => {
    it('should return to previous step and clear busy', () => {
      const state: OnboardingFlowState = {
        step: 'Busy',
        onboardingState: getDefaultOnboardingState(),
        busy: {
          returnToStep: 'Welcome',
          message: 'Processing...',
        },
      };
      const action: OnboardingFlowAction = { type: 'CLEAR_BUSY' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'Welcome');
      strictEqual(result.busy, undefined);
    });
  });

  describe('SET_ERROR action', () => {
    it('should set error state', () => {
      const state = createInitialState('Welcome');
      const action: OnboardingFlowAction = {
        type: 'SET_ERROR',
        payload: {
          returnToStep: 'Welcome',
          safeMessage: 'Something went wrong',
          debugCode: 'ERR_001',
        },
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'Error');
      strictEqual(result.error?.returnToStep, 'Welcome');
      strictEqual(result.error?.safeMessage, 'Something went wrong');
      strictEqual(result.error?.debugCode, 'ERR_001');
    });
  });

  describe('CLEAR_ERROR action', () => {
    it('should return to previous step and clear error', () => {
      const state: OnboardingFlowState = {
        step: 'Error',
        onboardingState: getDefaultOnboardingState(),
        error: {
          returnToStep: 'Welcome',
          safeMessage: 'Something went wrong',
        },
      };
      const action: OnboardingFlowAction = { type: 'CLEAR_ERROR' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'Welcome');
      strictEqual(result.error, undefined);
    });
  });

  describe('UPDATE_STATE action', () => {
    it('should update onboarding state', () => {
      const state = createInitialState('Welcome');
      const action: OnboardingFlowAction = {
        type: 'UPDATE_STATE',
        payload: {
          onboardingCompleted: true,
        },
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.onboardingState.onboardingCompleted, true);
      strictEqual(typeof result.onboardingState.updatedAt, 'string');
    });

    it('should merge partial state updates', () => {
      const state = createInitialState('Welcome', {
        onboardingCompleted: false,
      });
      const action: OnboardingFlowAction = {
        type: 'UPDATE_STATE',
        payload: {
          notion: {
            status: 'authed',
            workspace: {
              workspaceId: 'test-workspace-id',
            },
          },
        },
      };
      const result = onboardingReducer(state, action);
      strictEqual(result.onboardingState.notion.status, 'authed');
      strictEqual(
        result.onboardingState.notion.workspace?.workspaceId,
        'test-workspace-id',
      );
      strictEqual(result.onboardingState.onboardingCompleted, false);
    });
  });

  describe('RESET action', () => {
    it('should reset to initial state', () => {
      const state: OnboardingFlowState = {
        step: 'Done',
        onboardingState: {
          ...getDefaultOnboardingState(),
          onboardingCompleted: true,
        },
      };
      const action: OnboardingFlowAction = { type: 'RESET' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'Welcome');
      strictEqual(result.onboardingState.onboardingCompleted, false);
    });
  });

  describe('CANCEL action', () => {
    it('should go to CancelConfirm', () => {
      const state = createInitialState('Welcome');
      const action: OnboardingFlowAction = { type: 'CANCEL' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'CancelConfirm');
    });
  });

  describe('CONFIRM_CANCEL action', () => {
    it('should go to Done', () => {
      const state = createInitialState('CancelConfirm');
      const action: OnboardingFlowAction = { type: 'CONFIRM_CANCEL' };
      const result = onboardingReducer(state, action);
      strictEqual(result.step, 'Done');
    });
  });
});
