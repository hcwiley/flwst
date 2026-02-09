/**
 * Main content pane: Daily Note preview and Kanban board.
 * Kanban is always shown; data comes from notionSync (store) and ingest task feed (artifact).
 * Display-level dedup: ingest tasks whose title matches a Notion task are omitted (Notion is canonical).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, Stack, Text, XStack, YStack } from 'tamagui';
import { useAppStore } from '@flwst/state';
import type {
  DailyNoteProps,
  PublishResult,
  TaskProps,
  TaskStatus,
} from '@flwst/types';
import type { InboxIngestResult } from './inbox/types';
import { DailyNotePreview } from './main/DailyNotePreview';
import { KanbanBoard } from './main/KanbanBoard';
import { ingestTaskToDisplay, notionTaskToDisplay } from './main/kanbanTypes';
import { MainPaneHeader } from './main/MainPaneHeader';

interface MainPaneProps {
  lastRun: InboxIngestResult | null;
  /** When provided, run-failed state shows a "Try again" button that clears the run so the user can re-run from Inbox. */
  onClearRun?: () => void;
}

export function MainPane({
  lastRun,
  onClearRun,
}: MainPaneProps): React.JSX.Element {
  const [markdown, setMarkdown] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [taskProps, setTaskProps] = useState<TaskProps[]>([]);
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);
  const [isTaskLoading, setIsTaskLoading] = useState(false);
  const [taskMoveError, setTaskMoveError] = useState<string | null>(null);
  const [dailyNoteProps, setDailyNoteProps] = useState<DailyNoteProps | null>(
    null,
  );
  const [_dailyNotePropsError, setDailyNotePropsError] = useState<
    string | null
  >(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(
    null,
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const notionTasksById = useAppStore((s) => s.notionSync.tasksById);
  const isSyncing = useAppStore((s) => s.notionSync.isSyncing);
  const notionSyncError = useAppStore((s) => s.notionSync.lastError);
  const startSync = useAppStore((s) => s.startSync);
  const updateTaskStatus = useAppStore((s) => s.updateTaskStatus);

  const notionTasks = useMemo(
    () => Object.values(notionTasksById),
    [notionTasksById],
  );
  const notionDisplays = useMemo(
    () => notionTasks.map(notionTaskToDisplay),
    [notionTasks],
  );
  const ingestDisplays = useMemo(
    () => taskProps.map(ingestTaskToDisplay),
    [taskProps],
  );
  const kanbanTasks = useMemo(() => {
    const notionTitles = new Set(
      notionTasks.map((t) => t.title.trim().toLowerCase()),
    );
    const dedupedIngest = ingestDisplays.filter(
      (t) => !notionTitles.has(t.name.trim().toLowerCase()),
    );
    return [...notionDisplays, ...dedupedIngest];
  }, [notionDisplays, ingestDisplays, notionTasks]);
  const kanbanLoadError = taskLoadError ?? notionSyncError?.message ?? null;
  const kanbanLoading = isTaskLoading || isSyncing;
  const initialSyncRequested = useRef(false);
  const hasPublishable = taskProps.length > 0 || dailyNoteProps != null;

  useEffect(() => {
    if (initialSyncRequested.current) return;
    if (isSyncing) return;
    if (Object.keys(notionTasksById).length > 0) return;
    initialSyncRequested.current = true;
    startSync();
    window.api.notion.sync().catch(() => {
      // Errors are surfaced through the syncComplete event.
    });
  }, [isSyncing, notionTasksById, startSync]);

  useEffect(() => {
    if (!lastRun?.llmSuccess) {
      setMarkdown('');
      setLoadError(lastRun?.llmError ?? null);
      setIsLoading(false);
      setTaskProps([]);
      setTaskLoadError(lastRun?.llmError ?? null);
      setIsTaskLoading(false);
      setDailyNoteProps(null);
      setDailyNotePropsError(null);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setLoadError(null);
    setMarkdown('');
    setIsTaskLoading(true);
    setTaskLoadError(null);
    setTaskProps([]);
    setDailyNoteProps(null);
    setDailyNotePropsError(null);

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

    window.api.artifacts
      .readTextFile(lastRun.dailyNotePropsPath)
      .then((content) => {
        if (!isActive) return;
        const parsed = JSON.parse(content) as DailyNoteProps;
        setDailyNoteProps(parsed);
      })
      .catch((error) => {
        if (!isActive) return;
        setDailyNotePropsError(
          error instanceof Error
            ? error.message
            : 'Failed to load daily note props',
        );
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

  const handlePublish = useCallback(async () => {
    if (!hasPublishable || isPublishing) return;
    setIsPublishing(true);
    setPublishError(null);
    setPublishResult(null);
    try {
      const sourceRunId = lastRun?.runId;
      const drafts = taskProps.map((task) => ({
        ...task,
        sourceRunId,
      }));
      const result = await window.api.notion.publishDrafts({
        tasks: drafts,
        dailyNote: dailyNoteProps
          ? {
              ...dailyNoteProps,
              content: markdown,
              sourceRunId,
            }
          : undefined,
      });
      setPublishResult(result);
    } catch (error) {
      setPublishError(
        error instanceof Error ? error.message : 'Publish to Notion failed',
      );
    } finally {
      setIsPublishing(false);
    }
  }, [taskProps, isPublishing, lastRun?.runId, dailyNoteProps, hasPublishable]);

  const handleMoveTask = useCallback(
    async (taskId: string, status: TaskStatus) => {
      const existing = notionTasksById[taskId];
      if (!existing) return;
      if (existing.status === status) return;
      setTaskMoveError(null);
      updateTaskStatus(taskId, status);
      try {
        const result = await window.api.notion.updateTaskStatus({
          taskId,
          status,
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
      } catch (error) {
        updateTaskStatus(taskId, existing.status);
        setTaskMoveError(
          error instanceof Error
            ? error.message
            : 'Failed to update task status',
        );
      }
    },
    [notionTasksById, updateTaskStatus],
  );

  return (
    <Stack
      flex={1}
      borderRightWidth={1}
      borderColor='$gray4'
      overflow='hidden'
    >
      <YStack
        flex={1}
        padding='$4'
        gap='$3'
        backgroundColor='$background'
      >
        <XStack
          flex={0.1}
          alignItems='center'
          justifyContent='flex-end'
        >
          <Stack flex={0.8}>
            <MainPaneHeader lastRun={lastRun} />
          </Stack>
          {hasPublishable && (
            <Stack
              flexDirection='row'
              alignItems='flex-end'
              justifyContent='flex-end'
              flex={0.2}
              gap='$2'
              flexWrap='wrap'
            >
              <Button
                size='$3'
                theme='active'
                disabled={isPublishing}
                onPress={handlePublish}
                icon={isPublishing ? <Spinner size='small' /> : undefined}
              >
                {isPublishing ? 'Publishing…' : 'Publish to Notion'}
              </Button>
              {publishError && (
                <Text
                  fontSize='$2'
                  color='$red10'
                >
                  {publishError}
                </Text>
              )}
              {publishResult && !publishError && (
                <Text
                  fontSize='$2'
                  color='$gray10'
                >
                  Created {publishResult.created}, updated{' '}
                  {publishResult.updated}, skipped {publishResult.skipped}.
                </Text>
              )}
            </Stack>
          )}
        </XStack>

        {!lastRun && (
          <Stack
            flex={1}
            alignItems='center'
            justifyContent='center'
            padding='$4'
            maxWidth={400}
          >
            <Text
              textAlign='center'
              opacity={0.85}
              lineHeight='$2'
            >
              No run yet — drop a transcript in the Inbox and run ingest to see
              your daily note and tasks here.
            </Text>
          </Stack>
        )}

        {lastRun && !lastRun.llmSuccess && (
          <Stack
            flex={1}
            alignItems='center'
            justifyContent='center'
            padding='$3'
            gap='$3'
          >
            <Text
              color='$red10'
              textAlign='center'
            >
              {loadError ??
                'Run failed. LLM output is not available for this run.'}
            </Text>
            {onClearRun && (
              <Button
                size='$3'
                theme='active'
                onPress={onClearRun}
              >
                Try again
              </Button>
            )}
          </Stack>
        )}

        {lastRun?.llmSuccess && (
          <Stack
            flex={0.5}
            maxHeight={'40vh'}
          >
            <DailyNotePreview
              markdown={markdown}
              isLoading={isLoading}
              loadError={loadError}
            />
          </Stack>
        )}

        <Stack flex={1}>
          {taskMoveError && (
            <Text
              fontSize='$2'
              color='$red10'
            >
              {taskMoveError}
            </Text>
          )}
          <KanbanBoard
            tasks={kanbanTasks}
            isLoading={kanbanLoading}
            loadError={kanbanLoadError}
            onMoveTask={handleMoveTask}
          />
        </Stack>
      </YStack>
    </Stack>
  );
}
