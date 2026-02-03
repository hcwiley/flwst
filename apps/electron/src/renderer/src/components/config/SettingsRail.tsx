/**
 * Collapsible right-side rail for settings.
 * Collapsed state shows a compact icon-only rail for quick expand.
 */

import { useCallback, useState } from 'react';
import { Button, Stack, Text, YStack } from 'tamagui';
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
}: SettingsRailProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(true);
  const [selectedPromptKey, setSelectedPromptKey] = useState<PromptKey | null>(
    null,
  );

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
        {!collapsed && (
          <Text
            fontSize='$6'
            fontWeight='600'
          >
            {title}
          </Text>
        )}
        <Button
          size='$3'
          onPress={toggleCollapsed}
          aria-label={
            collapsed ? 'Expand settings rail' : 'Collapse settings rail'
          }
        >
          {collapsed ? '>' : '<'}
        </Button>
      </Stack>

      {/* Icon-only rail when collapsed to keep layout minimal */}
      {collapsed ? (
        <YStack
          flex={1}
          alignItems='center'
          justifyContent='flex-start'
          paddingTop='$4'
          gap='$3'
        >
          <Button
            size='$3'
            onPress={toggleCollapsed}
            aria-label='Open settings'
          >
            SET
          </Button>
        </YStack>
      ) : (
        <Stack
          flex={1}
          overflow='hidden'
        >
          <ConfigPane
            selectedPromptKey={selectedPromptKey}
            config={config}
            defaults={defaults}
            effective={effective}
            onConfigChange={onConfigChange}
            onSelectPrompt={setSelectedPromptKey}
            loadConfig={loadConfig}
          />
        </Stack>
      )}
    </Stack>
  );
}
