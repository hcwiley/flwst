/**
 * Main pane header showing title and run metadata.
 */

import { Stack, Text } from 'tamagui';
import type { InboxIngestResult } from '../inbox/types';

interface MainPaneHeaderProps {
  lastRun: InboxIngestResult | null;
}

export function MainPaneHeader({
  lastRun,
}: MainPaneHeaderProps): React.JSX.Element {
  return (
    <Stack gap='$1'>
      <Text
        fontSize='$7'
        fontWeight='600'
      >
        Daily Note + Kanban
      </Text>
      {lastRun ? (
        <Text
          fontSize='$3'
          opacity={0.7}
        >
          {lastRun.filename} · {lastRun.runId.slice(0, 8)} ·{' '}
          {lastRun.llmSuccess ? 'LLM OK' : 'LLM Error'}
        </Text>
      ) : (
        <Text
          fontSize='$3'
          opacity={0.7}
        >
          Run a transcript to preview the daily note output.
        </Text>
      )}
    </Stack>
  );
}
