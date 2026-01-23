/**
 * Busy screen - shown during async operations.
 */

import { Stack, Text, Spinner } from 'tamagui';
import type { BusyState } from '../types';

export interface BusyScreenProps {
  busy: BusyState;
}

export function BusyScreen({ busy }: BusyScreenProps): React.JSX.Element {
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
      {busy.message && (
        <Text
          fontSize='$4'
          textAlign='center'
          opacity={0.8}
        >
          {busy.message}
        </Text>
      )}
    </Stack>
  );
}
