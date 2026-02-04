/**
 * Main content pane: Daily Note preview and Kanban board.
 */

import { useEffect, useState } from 'react';
import { ScrollView, Separator, Stack, Text, YStack } from 'tamagui';
import type { InboxIngestResult } from './inbox/types';
import type { TaskProps } from '@flwst/types';
import { DailyNotePreview } from './main/DailyNotePreview';
import { KanbanBoard } from './main/KanbanBoard';
import { MainPaneHeader } from './main/MainPaneHeader';

interface MainPaneProps {
  lastRun: InboxIngestResult | null;
}

export function MainPane({ lastRun }: MainPaneProps): React.JSX.Element {
  const [markdown, setMarkdown] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [taskProps, setTaskProps] = useState<TaskProps[]>([]);
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);
  const [isTaskLoading, setIsTaskLoading] = useState(false);

  useEffect(() => {
    if (!lastRun?.llmSuccess) {
      setMarkdown('');
      setLoadError(lastRun?.llmError ?? null);
      setIsLoading(false);
      setTaskProps([]);
      setTaskLoadError(lastRun?.llmError ?? null);
      setIsTaskLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setLoadError(null);
    setMarkdown('');
    setIsTaskLoading(true);
    setTaskLoadError(null);
    setTaskProps([]);

    window.api.artifacts
      .readTextFile(lastRun.dailyNotePath)
      .then((content) => {
        if (!isActive) return;
        setMarkdown(content);
      })
      .catch((error) => {
        if (!isActive) return;
        setLoadError(
          error instanceof Error ? error.message : 'Failed to load daily note',
        );
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    if (!lastRun.taskFeedPropsPath) {
      setTaskLoadError('Task feed props not available for this run.');
      setIsTaskLoading(false);
    } else {
      window.api.artifacts
        .readTextFile(lastRun.taskFeedPropsPath)
        .then((content) => {
          if (!isActive) return;
          const parsed = JSON.parse(content) as TaskProps[];
          setTaskProps(parsed);
        })
        .catch((error) => {
          if (!isActive) return;
          setTaskLoadError(
            error instanceof Error
              ? error.message
              : 'Failed to load task props',
          );
        })
        .finally(() => {
          if (!isActive) return;
          setIsTaskLoading(false);
        });
    }

    return () => {
      isActive = false;
    };
  }, [lastRun]);

  return (
    <Stack
      flex={1}
      borderRightWidth={1}
      borderColor='$gray4'
      overflow='hidden'
    >
      <Stack
        flex={1}
        padding='$4'
        gap='$3'
        backgroundColor='$background'
      >
        <MainPaneHeader lastRun={lastRun} />

        {!lastRun && (
          <Stack
            flex={1}
            alignItems='center'
            justifyContent='center'
          >
            <Text opacity={0.7}>
              This area will host the review and task board panes.
            </Text>
          </Stack>
        )}

        {lastRun && !lastRun.llmSuccess && (
          <Stack
            flex={1}
            alignItems='center'
            justifyContent='center'
            padding='$3'
          >
            <Text color='$red10'>
              {loadError ?? 'LLM output not available for this run.'}
            </Text>
          </Stack>
        )}

        {lastRun && lastRun.llmSuccess && (
          <YStack
            flex={1}
            gap='$3'
          >
            <Stack
              flex={1}
              // minHeight={'50vh'}
              // maxHeight={'50vh'}
            >
              <DailyNotePreview
                markdown={markdown}
                isLoading={isLoading}
                loadError={loadError}
              />
            </Stack>
            <Separator marginVertical='$3' />
            <Stack
              flex={1}
              // minHeight={'50vh'}
              // maxHeight={'50vh'}
            >
              <KanbanBoard
                tasks={taskProps}
                isLoading={isTaskLoading}
                loadError={taskLoadError}
              />
            </Stack>
          </YStack>
        )}
      </Stack>
    </Stack>
  );
}
