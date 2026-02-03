/**
 * Config pane: preprocess toggle and prompt editors (default, effective, reset).
 */

import { useCallback, useState } from 'react';
import { Stack, Text, Button, Spinner, YStack } from 'tamagui';
import type { UserConfig } from '@flwst/types';
import { PromptEditor } from './PromptEditor';

type PromptKey = 'dailyNote' | 'taskDraft';

interface ConfigPaneProps {
  selectedPromptKey: PromptKey | null;
  config: UserConfig | null;
  defaults: { dailyNote: string; taskDraft: string } | null;
  effective: { dailyNote: string; taskDraft: string } | null;
  onConfigChange: (config: UserConfig) => void;
  onSelectPrompt?: (key: PromptKey | null) => void;
  loadConfig: () => Promise<void>;
}

export function ConfigPane({
  selectedPromptKey,
  config,
  defaults,
  effective,
  onConfigChange,
  loadConfig,
}: ConfigPaneProps): React.JSX.Element {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEffectiveChange = useCallback(
    (key: PromptKey) => (value: string) => {
      if (!config || !effective) return;
      const nextPrompts = { ...config.prompts, [key]: value };
      onConfigChange({ ...config, prompts: nextPrompts });
    },
    [config, effective, onConfigChange],
  );

  const handleSavePrompt = useCallback(async () => {
    if (!config || !selectedPromptKey) return;
    setSaving(true);
    setError(null);
    try {
      const prompts = { ...config.prompts };
      if (prompts.dailyNote === '') delete prompts.dailyNote;
      if (prompts.taskDraft === '') delete prompts.taskDraft;
      const updated = await window.api.config.update({ prompts });
      onConfigChange(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [config, selectedPromptKey, onConfigChange]);

  const handleReset = useCallback(async () => {
    if (!selectedPromptKey) return;
    setSaving(true);
    setError(null);
    try {
      const { config: updated } =
        await window.api.config.resetPrompt(selectedPromptKey);
      onConfigChange(updated);
      await loadConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset');
    } finally {
      setSaving(false);
    }
  }, [selectedPromptKey, onConfigChange, loadConfig]);

  const handlePreprocessToggle = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await window.api.config.update({
        preprocess: {
          ...config.preprocess,
          enabled: !config.preprocess.enabled,
        },
      });
      onConfigChange(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }, [config, onConfigChange]);

  if (defaults === null || effective === null) {
    return (
      <Stack
        flex={1}
        alignItems='center'
        justifyContent='center'
        padding='$4'
      >
        <Spinner size='large' />
      </Stack>
    );
  }

  const hasOverride =
    selectedPromptKey &&
    config?.prompts[selectedPromptKey] != null &&
    config.prompts[selectedPromptKey]!.length > 0;

  return (
    <Stack
      flex={1}
      flexDirection='column'
      padding='$4'
      gap='$4'
    >
      <Text
        fontSize='$8'
        fontWeight='bold'
        marginBottom='$2'
      >
        Config
      </Text>

      <YStack gap='$2'>
        <Text
          fontSize='$5'
          fontWeight='600'
        >
          Preprocess
        </Text>
        <Stack
          flexDirection='row'
          alignItems='center'
          gap='$3'
        >
          <Button
            size='$3'
            theme={config?.preprocess.enabled ? 'active' : 'gray'}
            onPress={handlePreprocessToggle}
            disabled={saving || !config}
          >
            {config?.preprocess.enabled ? 'On' : 'Off'}
          </Button>
          <Text
            fontSize='$3'
            color='$color'
            opacity={0.8}
          >
            Dictionary + ignore list applied before prompts
          </Text>
        </Stack>
      </YStack>

      <YStack gap='$2'>
        <Text
          fontSize='$5'
          fontWeight='600'
        >
          Prompts
        </Text>
        <Text
          fontSize='$3'
          color='$color'
          opacity={0.8}
        >
          Select a prompt in the sidebar to edit. Effective = override if set,
          else default.
        </Text>
      </YStack>

      {selectedPromptKey && (
        <>
          <PromptEditor
            promptKey={selectedPromptKey}
            title={
              selectedPromptKey === 'dailyNote'
                ? 'Daily Note + Task Feed'
                : 'Task Draft'
            }
            defaultTemplate={
              selectedPromptKey === 'dailyNote'
                ? defaults.dailyNote
                : defaults.taskDraft
            }
            effectiveTemplate={
              selectedPromptKey === 'dailyNote'
                ? effective.dailyNote
                : effective.taskDraft
            }
            hasOverride={!!hasOverride}
            onEffectiveChange={handleEffectiveChange(selectedPromptKey)}
            onReset={handleReset}
            disabled={saving}
          />
          <Button
            size='$4'
            theme='active'
            onPress={handleSavePrompt}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save override'}
          </Button>
        </>
      )}

      {!selectedPromptKey && (
        <Text
          fontSize='$4'
          color='$color'
          opacity={0.7}
        >
          Select Daily Note or Task Draft in the sidebar to edit.
        </Text>
      )}

      {error && (
        <Text
          color='$red10'
          fontSize='$3'
        >
          {error}
        </Text>
      )}
    </Stack>
  );
}
