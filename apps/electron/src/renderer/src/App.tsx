import { Stack } from 'tamagui';
import { FlowStateTamaguiProvider } from '@flwst/ui';
import { SideMenu } from './components/SideMenu';
import { MainPane } from './components/MainPane';

function App(): React.JSX.Element {
  return (
    <FlowStateTamaguiProvider defaultTheme='light'>
      <Stack
        flexDirection='row'
        height='100vh'
        width='100vw'
      >
        <SideMenu />
        <MainPane />
      </Stack>
    </FlowStateTamaguiProvider>
  );
}

export default App;
