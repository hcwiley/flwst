/**
 * Onboarding status bar.
 * Renders a compact progress indicator and current step label to help users
 * understand overall onboarding progress and to aid debugging during development.
 */

import { Stack, Text, XStack } from 'tamagui';
import type { OnboardingStep } from './types';

/**
 * Human-friendly labels for each step.
 * These labels are intentionally short to fit in the footer.
 */
const STEP_LABELS: Record<OnboardingStep, string> = {
  Welcome: 'Welcome',
  SystemSelect: 'Choose System',
  FeatureRequest: 'Feature Request',
  FeatureRequestThankYou: 'Request Submitted',
  NotionExplain: 'Notion Overview',
  NotionOAuthStart: 'Connect Notion',
  NotionOAuthComplete: 'Finish OAuth',
  ParentSelect: 'Pick Parent Page',
  ConfirmCreate: 'Confirm Setup',
  CreateResources: 'Create Resources',
  StatusConversion: 'Convert Status',
  Busy: 'Working',
  Error: 'Error',
  CancelConfirm: 'Cancel',
  Done: 'Complete',
};

export interface OnboardingStatusBarProps {
  currentStep: OnboardingStep;
  progressStep: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  percentComplete: number;
}

/**
 * Footer progress bar for onboarding.
 */
export function OnboardingStatusBar({
  currentStep,
  progressStep,
  stepIndex,
  totalSteps,
  percentComplete,
}: OnboardingStatusBarProps): React.JSX.Element {
  const safePercent = Math.max(0, Math.min(100, percentComplete));
  const safeStepNumber = Math.min(totalSteps, Math.max(1, stepIndex + 1));

  return (
    <Stack
      borderTopWidth={1}
      borderColor='$gray6'
      padding='$3'
      backgroundColor='$gray1'
    >
      <XStack
        alignItems='center'
        justifyContent='space-between'
        gap='$3'
      >
        <Stack
          flex={1}
          gap='$2'
        >
          <Text
            fontSize='$2'
            color='$gray10'
          >
            Onboarding progress
          </Text>
          <Stack
            height={8}
            backgroundColor='$gray4'
            borderRadius='$2'
            overflow='hidden'
          >
            <Stack
              width={`${safePercent}%`}
              backgroundColor='$blue9'
              height='100%'
            />
          </Stack>
          <Text
            fontSize='$2'
            color='$gray11'
          >
            Step {safeStepNumber} of {totalSteps}: {STEP_LABELS[progressStep]}
          </Text>
        </Stack>

        <Stack alignItems='flex-end'>
          <Text
            fontSize='$2'
            color='$gray10'
          >
            Current step
          </Text>
          <Text
            fontSize='$2'
            color='$gray12'
            fontWeight='600'
          >
            {currentStep}
          </Text>
        </Stack>
      </XStack>
    </Stack>
  );
}
