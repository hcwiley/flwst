/**
 * Daily note panel for previewing and editing extracted notes.
 *
 * Supports raw markdown editing and preview rendering in a single block.
 */
import { Button, Switch, Text, TextArea, XStack, YStack } from 'tamagui';
import { Markdown } from './Markdown';
import type { DailyNotePanelProps } from '../types/ui';

/**
 * Display the daily note with preview/raw toggle controls.
 */
export function DailyNotePanel({
  dailyNote,
  view,
  onViewChange,
  onUpdate,
  onSubmitAll,
}: DailyNotePanelProps) {
  return (
    <YStack gap="$2" p="$2" borderWidth={1} borderColor="$borderColor" borderRadius="$3">
      <XStack jc="space-between" ai="center">
        <Text fontWeight="bold">Daily Note</Text>
        <XStack ai="center" gap="$3">
          <XStack ai="center" gap="$2">
            <Text fontSize="$2" color={view === 'preview' ? '$color' : '$color.gray10'}>
              Preview
            </Text>
            <Switch
              size="$2"
              checked={view === 'raw'}
              onCheckedChange={(value) => onViewChange(value ? 'raw' : 'preview')}
            />
            <Text fontSize="$2" color={view === 'raw' ? '$color' : '$color.gray10'}>
              Raw
            </Text>
          </XStack>
          <Button size="$2" theme="green" onPress={onSubmitAll}>
            Submit All
          </Button>
        </XStack>
      </XStack>
      {view === 'raw' ? (
        <TextArea
          value={dailyNote.dailyNoteRichMarkdown}
          onChangeText={(value) => onUpdate({ dailyNoteRichMarkdown: value })}
          minHeight={120}
        />
      ) : (
        <Markdown content={dailyNote.dailyNoteRichMarkdown} />
      )}
    </YStack>
  );
}
