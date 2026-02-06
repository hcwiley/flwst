/**
 * Main pane header showing title and run metadata.
 */

import { XStack } from 'tamagui';
import { H1, MetaText } from '@flwst/ui';
import type { InboxIngestResult } from '../inbox/types';

interface MainPaneHeaderProps {
  lastRun: InboxIngestResult | null;
}

export function MainPaneHeader({
  lastRun,
}: MainPaneHeaderProps): React.JSX.Element {
  return (
    <XStack
      gap='$3'
      alignItems='center'
      justifyContent='flex-start'
    >
      <H1 fontSize='$7'>Daily Note + Kanban</H1>
      {lastRun ? (
        <MetaText>
          {lastRun.filename} · {lastRun.runId.slice(0, 8)} ·{' '}
          {lastRun.llmSuccess ? 'LLM OK' : 'LLM Error'}
        </MetaText>
      ) : (
        <MetaText>Run a transcript to preview the daily note output.</MetaText>
      )}
    </XStack>
  );
}
