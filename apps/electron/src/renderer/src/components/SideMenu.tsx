/**
 * Side menu: app title, config section (preprocess, prompt list).
 */

import { Stack, Text, Button } from 'tamagui';
import type { UserConfig } from '@flwst/types';

type PromptKey = 'dailyNote' | 'taskDraft';

interface SideMenuProps {
  selectedPromptKey: PromptKey | null;
  onSelectPrompt: (key: PromptKey | null) => void;
  config: UserConfig | null;
}

export function SideMenu({
  selectedPromptKey,
  onSelectPrompt,
  config,
}: SideMenuProps): React.JSX.Element {
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
      <Text
        fontSize='$4'
        color='$color'
        opacity={0.7}
        marginBottom='$3'
      >
        Config
      </Text>
      {config && (
        <Stack
          flexDirection='column'
          gap='$2'
          marginBottom='$3'
        >
          <Text
            fontSize='$2'
            color='$color'
            opacity={0.6}
          >
            Preprocess: {config.preprocess.enabled ? 'On' : 'Off'}
          </Text>
        </Stack>
      )}
      <Stack flexDirection='column'>
        <Button
          size='$3'
          theme={selectedPromptKey === 'dailyNote' ? 'active' : 'gray'}
          marginBottom='$2'
          onPress={() =>
            onSelectPrompt(
              selectedPromptKey === 'dailyNote' ? null : 'dailyNote',
            )
          }
        >
          Daily Note
        </Button>
        <Button
          size='$3'
          theme={selectedPromptKey === 'taskDraft' ? 'active' : 'gray'}
          onPress={() =>
            onSelectPrompt(
              selectedPromptKey === 'taskDraft' ? null : 'taskDraft',
            )
          }
        >
          Task Draft
        </Button>
      </Stack>
    </Stack>
  );
}
