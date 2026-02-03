/**
 * Main content pane: Inbox (left), center stub, and Config rail (right).
 */

import { Stack } from 'tamagui';
import { MainCenterPane } from './MainCenterPane';

export function MainPane(): React.JSX.Element {
  return (
    <Stack
      flex={1}
      borderRightWidth={1}
      borderColor='$gray4'
      overflow='hidden'
    >
      <MainCenterPane />
    </Stack>
  );
}
