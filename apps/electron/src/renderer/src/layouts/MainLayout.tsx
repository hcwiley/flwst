/**
 * Main application layout.
 * Used after onboarding is complete.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack } from 'tamagui';
import { FlowStateTamaguiProvider } from '@flwst/ui';
import { SideMenu } from '../components/SideMenu';
import { MainPane } from '../components/MainPane';
import type { UserConfig } from '@flwst/types';

type PromptKey = 'dailyNote' | 'taskDraft';

export function MainLayout(): React.JSX.Element {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [defaults, setDefaults] = useState<{
    dailyNote: string;
    taskDraft: string;
  } | null>(null);
  const [selectedPromptKey, setSelectedPromptKey] = useState<PromptKey | null>(
    null,
  );

  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      const [cfg, defs] = await Promise.all([
        window.api.config.read(),
        window.api.config.getPromptDefaults(),
      ]);
      setConfig(cfg);
      setDefaults(defs);
    } catch (error) {
      console.error('Failed to load config', error);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const effective = useMemo(() => {
    if (!config || !defaults) return null;
    return {
      dailyNote: config.prompts.dailyNote ?? defaults.dailyNote,
      taskDraft: config.prompts.taskDraft ?? defaults.taskDraft,
    };
  }, [config, defaults]);

  return (
    <FlowStateTamaguiProvider defaultTheme='light'>
      <Stack
        flexDirection='row'
        height='100vh'
        width='100vw'
      >
        <SideMenu
          selectedPromptKey={selectedPromptKey}
          onSelectPrompt={setSelectedPromptKey}
          config={config}
        />
        <MainPane
          config={config}
          defaults={defaults}
          effective={effective}
          selectedPromptKey={selectedPromptKey}
          onConfigChange={setConfig}
          onSelectPrompt={setSelectedPromptKey}
          loadConfig={loadConfig}
        />
      </Stack>
    </FlowStateTamaguiProvider>
  );
}
