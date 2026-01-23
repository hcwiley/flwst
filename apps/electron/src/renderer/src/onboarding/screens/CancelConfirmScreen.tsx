/**
 * Cancel confirmation screen.
 */

import { Stack, Text, Button } from 'tamagui';

export interface CancelConfirmScreenProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancelConfirmScreen({
  onConfirm,
  onCancel,
}: CancelConfirmScreenProps): React.JSX.Element {
  return (
    <Stack
      flexDirection='column'
      flex={1}
      padding='$6'
      gap='$4'
      alignItems='center'
      justifyContent='center'
      maxWidth={500}
      alignSelf='center'
      width='100%'
    >
      <Text fontSize='$8' fontWeight='bold' textAlign='center'>
        Cancel Onboarding?
      </Text>
      <Text fontSize='$4' textAlign='center' opacity={0.8}>
        Are you sure you want to cancel? Your progress will be saved, but you
        won't be able to use FlowState until you complete setup.
      </Text>
      <Stack flexDirection='row' gap='$3' marginTop='$4' width='100%'>
        <Button onPress={onCancel} theme='gray' size='$4' flex={1}>
          Continue Setup
        </Button>
        <Button onPress={onConfirm} theme='red' size='$4' flex={1}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}
