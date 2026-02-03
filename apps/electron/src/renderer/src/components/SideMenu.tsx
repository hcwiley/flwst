/**
 * Side menu: app title only (config lives in right rail).
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
        flwst
      </Text>
    </Stack>
  );
}
