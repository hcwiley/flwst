/**
 * Processing status stepper for the session pipeline.
 *
 * Provides consistent UX feedback for multi-stage reasoning and submit flow.
 */
import { YStack, XStack, Text, Spinner, Button } from 'tamagui';

/**
 * Processing phase state
 */
type ProcessingPhase =
  | 'idle'
  | 'fetching'
  | 'analyzing'
  | 'reasoning'
  | 'matching'
  | 'submitting'
  | 'done'
  | 'error';

interface ProcessingStatusProps {
  phase: ProcessingPhase;
  error: string | null;
  warning: string | null;
  onDismissError: () => void;
  onDismissWarning: () => void;
}

/**
 * Step status for the stepper
 */
type StepStatus = 'pending' | 'active' | 'done' | 'error';

/**
 * Get step status based on current phase
 */
function getStepStatus(stepNumber: 1 | 2 | 3 | 4 | 5, phase: ProcessingPhase): StepStatus {
  if (phase === 'error') {
    // Mark the first in-progress step as error for clearer UX.
    if (stepNumber === 1 && phase === 'error') return 'error'; // This shouldn't happen with fetching
  }

  if (stepNumber === 1) {
    // Step 1: Fetching (Notion context)
    if (phase === 'fetching') return 'active';
    if (
      phase === 'analyzing' ||
      phase === 'reasoning' ||
      phase === 'matching' ||
      phase === 'done' ||
      phase === 'submitting' ||
      phase === 'error'
    )
      return 'done';
    return 'pending';
  }

  if (stepNumber === 2) {
    // Step 2: Analyzing (High-level notes)
    if (phase === 'analyzing') return 'active';
    if (phase === 'reasoning' || phase === 'matching' || phase === 'done' || phase === 'submitting')
      return 'done';
    if (phase === 'error') return 'error';
    return 'pending';
  }

  if (stepNumber === 3) {
    // Step 3: Reasoning (Detailed extraction)
    if (phase === 'reasoning') return 'active';
    if (phase === 'matching' || phase === 'done' || phase === 'submitting') return 'done';
    if (phase === 'error' && (phase as any) !== 'analyzing') return 'error';
    return 'pending';
  }

  if (stepNumber === 4) {
    // Step 4: Matching (Notion linking)
    if (phase === 'matching') return 'active';
    if (phase === 'done' || phase === 'submitting') return 'done';
    return 'pending';
  }

  // Step 5: Submitting
  if (phase === 'submitting') return 'active';
  if (phase === 'done' && (phase as any) !== 'submitting') return 'done';
  return 'pending';
}

/**
 * Get helper text for current phase
 */
function getHelperText(phase: ProcessingPhase): string {
  switch (phase) {
    case 'fetching':
      return 'Fetching Notion tasks/projects for context...';
    case 'analyzing':
      return 'Extracting potential todos and intent...';
    case 'reasoning':
      return 'Generating detailed tasks from transcript...';
    case 'matching':
      return 'Verifying tasks against Notion...';
    case 'submitting':
      return 'Creating/Updating pages in Notion...';
    case 'done':
      return 'Ready for review';
    case 'error':
      return 'Processing failed';
    default:
      return '';
  }
}

/**
 * Step indicator component
 */
function StepIndicator({ status, label }: { status: StepStatus; label: string }) {
  const getIndicator = () => {
    switch (status) {
      case 'active':
        return <Spinner size="small" />;
      case 'done':
        return <Text>✓</Text>;
      case 'error':
        return <Text color="$red10">✗</Text>;
      default:
        return <Text color="$color.gray8">○</Text>;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'active':
        return '$color';
      case 'done':
        return '$green10';
      case 'error':
        return '$red10';
      default:
        return '$color.gray10';
    }
  };

  return (
    <XStack ai="center" gap="$2">
      <XStack
        ai="center"
        jc="center"
        width={24}
        height={24}
        borderRadius="$12"
        backgroundColor={
          status === 'active'
            ? '$blue5'
            : status === 'done'
              ? '$green5'
              : status === 'error'
                ? '$red5'
                : '$gray5'
        }
      >
        {getIndicator()}
      </XStack>
      <Text fontSize="$3" color={getTextColor()} fontWeight={status === 'active' ? '600' : '400'}>
        {label}
      </Text>
    </XStack>
  );
}

/**
 * ProcessingStatus component showing 2-step progress indicator
 * with error and warning states
 */
export function ProcessingStatus({
  phase,
  error,
  warning,
  onDismissError,
  onDismissWarning,
}: ProcessingStatusProps) {
  const step1Status = getStepStatus(1, phase);
  const step2Status = getStepStatus(2, phase);
  const step3Status = getStepStatus(3, phase);
  const step4Status = getStepStatus(4, phase);
  const step5Status = getStepStatus(5, phase);
  const helperText = getHelperText(phase);

  return (
    <YStack gap="$2" padding="$3" backgroundColor="$backgroundHover" borderRadius="$4">
      {/* Stepper */}
      <XStack gap="$3" ai="center" flexWrap="wrap">
        <StepIndicator status={step1Status} label="Fetch" />
        <Text color="$color.gray8">→</Text>
        <StepIndicator status={step2Status} label="Analyze" />
        <Text color="$color.gray8">→</Text>
        <StepIndicator status={step3Status} label="Detail" />
        <Text color="$color.gray8">→</Text>
        <StepIndicator status={step4Status} label="Match" />
        <Text color="$color.gray8">→</Text>
        <StepIndicator status={step5Status} label="Submit" />
      </XStack>

      {/* Helper text */}
      {helperText && (
        <Text fontSize="$2" color="$color.gray11">
          {helperText}
        </Text>
      )}

      {/* Error message */}
      {error && (
        <XStack
          ai="center"
          jc="space-between"
          gap="$2"
          padding="$2"
          backgroundColor="$red3"
          borderRadius="$2"
        >
          <Text fontSize="$2" color="$red11" flex={1}>
            Error: {error}
          </Text>
          <Button size="$2" variant="outlined" onPress={onDismissError}>
            Dismiss
          </Button>
        </XStack>
      )}

      {/* Warning message */}
      {warning && (
        <XStack
          ai="center"
          jc="space-between"
          gap="$2"
          padding="$2"
          backgroundColor="$yellow3"
          borderRadius="$2"
        >
          <Text fontSize="$2" color="$yellow11" flex={1}>
            {warning}
          </Text>
          <Button size="$2" variant="outlined" onPress={onDismissWarning}>
            Dismiss
          </Button>
        </XStack>
      )}
    </YStack>
  );
}
