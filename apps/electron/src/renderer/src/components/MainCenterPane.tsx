/**
 * Main center pane stub for future DailyNote + Kanban views.
 * This placeholder keeps layout stable while Phase 7/8 UI is built.
 */

import { Stack, Text } from 'tamagui';

export function MainCenterPane(): React.JSX.Element {
  return (
    <Stack
      flex={1}
      padding='$4'
      gap='$3'
      alignItems='center'
      justifyContent='center'
      backgroundColor='$background'
    >
      <Text
        fontSize='$7'
        fontWeight='600'
      >
        Daily Note + Kanban
      </Text>
      <Text
        fontSize='$4'
        opacity={0.7}
      >
        This area will host the review and task board panes.
      </Text>
    </Stack>
  );
}
