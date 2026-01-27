/**
 * Error screen component - shown when errors occur.
 * Generic reusable component for displaying error states.
 */

import { Stack, Text, Button } from 'tamagui';

export interface ErrorScreenProps {
  /**
   * User-friendly error message to display.
   */
  safeMessage: string;
  /**
   * Optional debug code for troubleshooting.
   */
  debugCode?: string;
  /**
   * Callback when user clicks retry.
   */
  onRetry: () => void;
  /**
   * Callback when user clicks cancel.
   */
  onCancel: () => void;
}

/**
 * Error screen component displaying error message and action buttons.
 */
export function ErrorScreen({
  safeMessage,
  debugCode,
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
      <Text
        fontSize='$8'
        fontWeight='bold'
        textAlign='center'
        color='$red10'
      >
        Error
      </Text>
      <Text
        fontSize='$4'
        textAlign='center'
        opacity={0.8}
      >
        {safeMessage}
      </Text>
      {debugCode && (
        <Text
          fontSize='$2'
          opacity={0.6}
          marginTop='$2'
        >
          Error code: {debugCode}
        </Text>
      )}
      <Stack
        flexDirection='row'
        gap='$3'
        marginTop='$4'
        width='100%'
      >
        <Button
          onPress={onCancel}
          theme='gray'
          size='$4'
          flex={1}
        >
          Cancel
        </Button>
        <Button
          onPress={onRetry}
          theme='active'
          size='$4'
          flex={1}
        >
          Retry
        </Button>
      </Stack>
    </Stack>
  );
}
