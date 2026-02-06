/**
 * Main application layout.
 * Used after onboarding is complete.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack } from 'tamagui';
import { FlowStateTamaguiProvider } from '@flwst/ui';
import { useAppStore } from '@flwst/state';
import { MainPane } from '../components/MainPane';
import type { UserConfig } from '@flwst/types';
import { InboxPane } from '../components/inbox';
import { SettingsRail } from '../components/config';
import { StatusPane } from '../components/status';
import { SyncButton } from '../components/SyncButton';
import type {
  InboxIngestResult,
  IngestStatus,
} from '../components/inbox/types';

export function MainLayout(): React.JSX.Element {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [defaults, setDefaults] = useState<{
    dailyNote: string;
    taskDraft: string;
  } | null>(null);

  // Run status state (lifted from InboxPane)
  const [runStatus, setRunStatus] = useState<IngestStatus>('idle');
  const [lastRun, setLastRun] = useState<InboxIngestResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const setKanbanPrefs = useAppStore((s) => s.setKanbanPrefs);

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

  useEffect(() => {
    if (!config) return;
    setKanbanPrefs(config.kanbanPrefs);
  }, [config, setKanbanPrefs]);

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
        flexDirection='column'
        height='100vh'
        width='100vw'
        backgroundColor='$background'
      >
        {/* Top bar with Sync on the right */}
        <Stack
          flexDirection='row'
          justifyContent='flex-end'
          alignItems='center'
          paddingHorizontal='$3'
          paddingVertical='$2'
          borderBottomWidth={1}
          borderColor='$gray4'
        >
          <SyncButton />
        </Stack>
        {/* Main content row */}
        <Stack
          flexDirection='row'
          flex={1}
          overflow='hidden'
        >
          <Stack
            width={360}
            borderRightWidth={1}
            borderColor='$gray4'
            overflow='hidden'
          >
            <InboxPane
              config={config}
              onStatusChange={setRunStatus}
              onRunComplete={setLastRun}
              onError={setRunError}
            />
          </Stack>
          <MainPane lastRun={lastRun} />
          <SettingsRail
            title='Settings'
            config={config}
            defaults={defaults}
            effective={effective}
            onConfigChange={setConfig}
            loadConfig={loadConfig}
          />
        </Stack>

        {/* Status pane at bottom */}
        <StatusPane
          status={runStatus}
          lastRun={lastRun}
          error={runError}
        />
      </Stack>
    </FlowStateTamaguiProvider>
  );
}
