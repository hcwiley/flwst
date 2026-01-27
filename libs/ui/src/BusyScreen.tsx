/**
 * Busy screen component - shown during async operations.
 * Generic reusable component for displaying loading states.
 */

import { Stack, Text, Spinner } from 'tamagui';

export interface BusyScreenProps {
  /**
   * Optional message to display below the spinner.
   */
  message?: string;
}

/**
 * Busy screen component displaying a spinner and optional message.
 */
export function BusyScreen({ message }: BusyScreenProps): React.JSX.Element {
  return (
    <Stack
      flexDirection='column'
      flex={1}
      padding='$6'
      gap='$4'
      alignItems='center'
      justifyContent='center'
    >
      <Spinner size='large' />
      {message && (
        <Text
          fontSize='$4'
          textAlign='center'
          opacity={0.8}
        >
          {message}
        </Text>
      )}
    </Stack>
  );
}
