/**
 * Single prompt editor: default (read-only), effective (editable), reset button.
 */

import { Stack, Text, TextArea, Button } from 'tamagui';

interface PromptEditorProps {
  promptKey: 'dailyNote' | 'taskDraft';
  title: string;
  defaultTemplate: string;
  effectiveTemplate: string;
  hasOverride: boolean;
  onEffectiveChange: (value: string) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function PromptEditor({
  promptKey: _promptKey,
  title,
  defaultTemplate,
  effectiveTemplate,
  hasOverride,
  onEffectiveChange,
  onReset,
  disabled = false,
}: PromptEditorProps): React.JSX.Element {
  return (
    <Stack
      flexDirection='column'
      gap='$3'
      marginBottom='$4'
    >
      <Text
        fontSize='$6'
        fontWeight='600'
      >
        {title}
      </Text>
      <Stack flexDirection='column'>
        <Text
          fontSize='$3'
          color='$color'
          opacity={0.8}
          marginBottom='$2'
        >
          Default (read-only)
        </Text>
        <TextArea
          value={defaultTemplate}
          readOnly
          editable={false}
          numberOfLines={8}
          backgroundColor='$gray3'
          padding='$2'
          fontSize='$3'
        />
      </Stack>
      <Stack flexDirection='column'>
        <Text
          fontSize='$3'
          color='$color'
          opacity={0.8}
          marginBottom='$2'
        >
          Effective {hasOverride ? '(override)' : '(using default)'}
        </Text>
        <TextArea
          value={effectiveTemplate}
          onChangeText={onEffectiveChange}
          numberOfLines={12}
          padding='$2'
          fontSize='$3'
          disabled={disabled}
        />
      </Stack>
      {hasOverride && (
        <Button
          size='$3'
          theme='active'
          onPress={onReset}
          disabled={disabled}
        >
          Reset to default
        </Button>
      )}
    </Stack>
  );
}
