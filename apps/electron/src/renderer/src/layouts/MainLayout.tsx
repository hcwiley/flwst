/**
 * Main application layout.
 * Used after onboarding is complete.
 */

import { Stack } from 'tamagui';
import { FlowStateTamaguiProvider } from '@flwst/ui';
import { SideMenu } from '../components/SideMenu';
import { MainPane } from '../components/MainPane';

export function MainLayout(): React.JSX.Element {
  return (
    <FlowStateTamaguiProvider defaultTheme='light'>
      <Stack flexDirection='row' height='100vh' width='100vw'>
        <SideMenu />
        <MainPane />
      </Stack>
    </FlowStateTamaguiProvider>
  );
}
