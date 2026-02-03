/**
 * Main content pane: shows config (prompts + preprocess) after onboarding.
 */

import { Stack } from 'tamagui';
import { ConfigPane } from './config';
import type { UserConfig } from '@flwst/types';

type PromptKey = 'dailyNote' | 'taskDraft';

interface MainPaneProps {
  config: UserConfig | null;
  defaults: { dailyNote: string; taskDraft: string } | null;
  effective: { dailyNote: string; taskDraft: string } | null;
  selectedPromptKey: PromptKey | null;
  onConfigChange: (config: UserConfig) => void;
  onSelectPrompt: (key: PromptKey | null) => void;
  loadConfig: () => Promise<void>;
}

export function MainPane({
  config,
  defaults,
  effective,
  selectedPromptKey,
  onConfigChange,
  onSelectPrompt,
  loadConfig,
}: MainPaneProps): React.JSX.Element {
  return (
    <Stack
      flexDirection='column'
      flex={1}
      backgroundColor='$background'
      overflow='hidden'
    >
      <ConfigPane
        selectedPromptKey={selectedPromptKey}
        config={config}
        defaults={defaults}
        effective={effective}
        onConfigChange={onConfigChange}
        onSelectPrompt={onSelectPrompt}
        loadConfig={loadConfig}
      />
    </Stack>
  );
}
