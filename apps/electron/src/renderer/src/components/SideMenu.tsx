/**
 * Side menu navigation component.
 * Placeholder for future navigation items.
 */

import { Stack, Text } from 'tamagui';

export function SideMenu(): React.JSX.Element {
  return (
    <Stack
      flexDirection='column'
      width={200}
      backgroundColor='$background'
      borderRightWidth={1}
      borderRightColor='$borderColor'
      padding='$4'
    >
      <Text
        fontSize='$6'
        fontWeight='bold'
        marginBottom='$4'
      >
        FlowState
      </Text>
      <Text
        fontSize='$4'
        color='$color'
        opacity={0.7}
      >
        Navigation placeholder
      </Text>
    </Stack>
  );
}
