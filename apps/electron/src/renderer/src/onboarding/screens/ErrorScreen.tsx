/**
 * Error screen - shown when errors occur.
 */

import { Stack, Text, Button } from 'tamagui';
import type { ErrorState } from '../types';

export interface ErrorScreenProps {
  error: ErrorState;
  onRetry: () => void;
  onCancel: () => void;
}

export function ErrorScreen({
  error,
  onRetry,
  onCancel,
}: ErrorScreenProps): React.JSX.Element {
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
      <Text fontSize='$8' fontWeight='bold' textAlign='center' color='$red10'>
        Error
      </Text>
      <Text fontSize='$4' textAlign='center' opacity={0.8}>
        {error.safeMessage}
      </Text>
      {error.debugCode && (
        <Text fontSize='$2' opacity={0.6} marginTop='$2'>
          Error code: {error.debugCode}
        </Text>
      )}
      <Stack flexDirection='row' gap='$3' marginTop='$4' width='100%'>
        <Button onPress={onCancel} theme='gray' size='$4' flex={1}>
          Cancel
        </Button>
        <Button onPress={onRetry} theme='active' size='$4' flex={1}>
          Retry
        </Button>
      </Stack>
    </Stack>
  );
}
