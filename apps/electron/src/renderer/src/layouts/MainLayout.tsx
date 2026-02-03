/**
 * Main application layout.
 * Used after onboarding is complete.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack } from 'tamagui';
import { FlowStateTamaguiProvider } from '@flwst/ui';
import { MainPane } from '../components/MainPane';
import type { UserConfig } from '@flwst/types';
import { InboxPane } from '../components/inbox';
import { SettingsRail } from '../components/config';

export function MainLayout(): React.JSX.Element {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [defaults, setDefaults] = useState<{
    dailyNote: string;
    taskDraft: string;
  } | null>(null);
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
        backgroundColor='$background'
      >
        <Stack
          width={360}
          borderRightWidth={1}
          borderColor='$gray4'
          overflow='hidden'
        >
          <InboxPane config={config} />
        </Stack>
        <MainPane />
        {/* Collapsible settings rail on the right (icon-only when collapsed) */}
        <SettingsRail
          title='Settings'
          config={config}
          defaults={defaults}
          effective={effective}
          onConfigChange={setConfig}
          loadConfig={loadConfig}
        />
      </Stack>
    </FlowStateTamaguiProvider>
  );
}
