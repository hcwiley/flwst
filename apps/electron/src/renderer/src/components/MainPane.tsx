/**
 * Main content pane component.
 * Placeholder for future main content areas.
 */

import { Stack, Text } from 'tamagui';

export function MainPane(): React.JSX.Element {
  return (
    <Stack
      flexDirection='column'
      flex={1}
      padding='$4'
      backgroundColor='$background'
    >
      <Text
        fontSize='$8'
        fontWeight='bold'
        marginBottom='$2'
      >
        Welcome to FlowState
      </Text>
      <Text
        fontSize='$4'
        color='$color'
        opacity={0.8}
        marginBottom='$4'
      >
        Main content area placeholder
      </Text>
    </Stack>
  );
}
