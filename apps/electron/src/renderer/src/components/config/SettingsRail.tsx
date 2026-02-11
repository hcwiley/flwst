/**
 * Collapsible right-side rail for settings.
 * Collapsed: single "Settings" button. Expanded: Panel with H2 header and ConfigPane.
 */

import type { JSX } from 'react';

import { useCallback, useState, useEffect } from 'react';
import { Button, Stack, Text, ScrollView } from 'tamagui';
import { H2, Panel } from '@flwst/ui';
import type { UserConfig } from '@flwst/types';
import { ConfigPane } from './ConfigPane';

type PromptKey = 'dailyNote' | 'taskDraft';

interface SettingsRailProps {
  title?: string;
  expandedWidth?: number;
  collapsedWidth?: number;
  config: UserConfig | null;
  defaults: { dailyNote: string; taskDraft: string } | null;
  effective: { dailyNote: string; taskDraft: string } | null;
  onConfigChange: (config: UserConfig) => void;
  loadConfig: () => Promise<void>;
}

export function SettingsRail({
  title = 'Settings',
  expandedWidth = 360,
  collapsedWidth = 56,
  config,
  defaults,
  effective,
  onConfigChange,
  loadConfig,
}: SettingsRailProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true);
  const [selectedPromptKey, setSelectedPromptKey] = useState<PromptKey | null>(
    null,
  );
  const [version, setVersion] = useState<string>('');

  // Load version on mount
  useEffect(() => {
    window.api.app.getVersion().then((v) => setVersion(v.formatted));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <Stack
      width={collapsed ? collapsedWidth : expandedWidth}
      borderLeftWidth={1}
      borderColor='$gray4'
      backgroundColor='$background'
      overflow='hidden'
    >
      <Stack
        flexDirection='row'
        alignItems='center'
        justifyContent={collapsed ? 'center' : 'space-between'}
        padding='$3'
        borderBottomWidth={1}
        borderColor='$gray3'
      >
        {!collapsed && <H2>{title}</H2>}
        <Button
          size='$3'
          onPress={toggleCollapsed}
          aria-label={collapsed ? 'Expand settings' : 'Collapse settings'}
        >
          {collapsed ? 'Settings' : '◀'}
        </Button>
      </Stack>

      {collapsed ? null : (
        <Panel flex={1} overflow='hidden' padding='$3'>
          <ScrollView flex={1}>
            <ConfigPane
              selectedPromptKey={selectedPromptKey}
              config={config}
              defaults={defaults}
              effective={effective}
              onConfigChange={onConfigChange}
              onSelectPrompt={setSelectedPromptKey}
              loadConfig={loadConfig}
            />
          </ScrollView>

          {/* Version footer */}
          <Stack
            padding='$2'
            borderTopWidth={1}
            borderColor='$gray3'
            alignItems='center'
          >
            <Text fontSize='$2' color='$gray9'>
              {version || 'Loading version...'}
            </Text>
          </Stack>
        </Panel>
      )}
    </Stack>
  );
}
