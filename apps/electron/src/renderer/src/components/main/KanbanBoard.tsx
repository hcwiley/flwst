/**
 * Kanban board rendering tasks grouped by core status columns.
 * Tasks are pre-normalized to KanbanTaskDisplay (status already normalized).
 * Board header: Toolbar with Sort control and Column visibility popover.
 */

import { track } from '@flwst/integrations';
import { useCallback, useState } from 'react';
import {
  Button,
  Popover,
  ScrollView,
  Separator,
  Text,
  XStack,
  YStack,
} from 'tamagui';
import { useAppStore } from '@flwst/state';
import { H2, MetaText, Panel, Toolbar } from '@flwst/ui';
import type { KanbanSortDir, KanbanSortKey, TaskStatus } from '@flwst/types';
import type { KanbanTaskDisplay } from './kanbanTypes';
import { KanbanColumn } from './KanbanColumn';
import { sortTasks } from './kanbanTypes';

interface KanbanBoardProps {
  tasks: KanbanTaskDisplay[];
  isLoading: boolean;
  loadError: string | null;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
}

const KANBAN_STATUSES: TaskStatus[] = [
  'Backlog',
  'To-do',
  'On Deck',
  'In progress',
  'BLOCKED',
  'Done',
  'Cancelled',
];

const SORT_OPTIONS: Array<{ key: KanbanSortKey; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'updatedAt', label: 'Last Updated' },
  { key: 'priority', label: 'Priority' },
  { key: 'project', label: 'Project' },
];

function formatLastSync(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function KanbanBoard({
  tasks,
  isLoading,
  loadError,
  onMoveTask,
}: KanbanBoardProps): React.JSX.Element {
  const kanbanPrefs = useAppStore((s) => s.kanbanPrefs);
  const setKanbanPrefs = useAppStore((s) => s.setKanbanPrefs);
  const lastSyncAt = useAppStore((s) => s.notionSync.lastSyncAt);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const updatePrefs = useCallback(
    async (
      partial: Partial<{
        sortKey: KanbanSortKey;
        sortDir: KanbanSortDir;
        visibleStatuses: TaskStatus[];
      }>,
    ) => {
      const previous = kanbanPrefs;
      const next = { ...kanbanPrefs, ...partial };
      setKanbanPrefs(next);
      setPrefsError(null);
      try {
        await window.api.config.update({ kanbanPrefs: next });
        track('Config Updated', { field: 'kanbanPrefs' });
      } catch (error) {
        setKanbanPrefs(previous);
        setPrefsError(
          error instanceof Error
            ? error.message
            : 'Failed to save kanban prefs',
        );
      }
    },
    [kanbanPrefs, setKanbanPrefs],
  );

  const handleSortKey = useCallback(
    (key: KanbanSortKey) => {
      if (key === kanbanPrefs.sortKey) return;
      const nextDir =
        key === 'updatedAt' && kanbanPrefs.sortDir === 'asc'
          ? 'desc'
          : kanbanPrefs.sortDir;
      void updatePrefs({ sortKey: key, sortDir: nextDir });
    },
    [kanbanPrefs.sortDir, kanbanPrefs.sortKey, updatePrefs],
  );

  const handleSortDir = useCallback(() => {
    const nextDir = kanbanPrefs.sortDir === 'asc' ? 'desc' : 'asc';
    void updatePrefs({ sortDir: nextDir });
  }, [kanbanPrefs.sortDir, updatePrefs]);

  const handleToggleStatus = useCallback(
    (status: TaskStatus) => {
      const visible = new Set(kanbanPrefs.visibleStatuses);
      if (visible.has(status)) {
        visible.delete(status);
      } else {
        visible.add(status);
      }
      void updatePrefs({ visibleStatuses: Array.from(visible) });
    },
    [kanbanPrefs.visibleStatuses, updatePrefs],
  );

  const visibleStatuses = KANBAN_STATUSES.filter((status) =>
    kanbanPrefs.visibleStatuses.includes(status),
  );

  const syncLabel = formatLastSync(lastSyncAt);
  const sortDirLabel = kanbanPrefs.sortDir === 'asc' ? 'Asc' : 'Desc';

  return (
    <ScrollView>
      <Panel
        flex={1}
        overflow='scroll'
        padding='$3'
        gap='$3'
      >
        {/* Board header: title + meta left; sort + columns right */}
        <Toolbar
          justifyContent='space-between'
          alignItems='flex-start'
          flexWrap='wrap'
        >
          <XStack
            gap='$3'
            alignItems='center'
            justifyContent='center'
          >
            <H2>Kanban</H2>
            {syncLabel ? <MetaText>Synced {syncLabel}</MetaText> : null}
          </XStack>
          <XStack
            gap='$2'
            alignItems='center'
            flexWrap='wrap'
          >
            <MetaText>Sort by</MetaText>
            {SORT_OPTIONS.map((option) => (
              <Button
                key={option.key}
                size='$2'
                theme={
                  kanbanPrefs.sortKey === option.key ? 'active' : undefined
                }
                fontWeight={
                  kanbanPrefs.sortKey === option.key ? '600' : undefined
                }
                onPress={() => handleSortKey(option.key)}
                aria-pressed={kanbanPrefs.sortKey === option.key}
              >
                {option.label}
              </Button>
            ))}
            <Button
              size='$2'
              onPress={handleSortDir}
              aria-label={`Sort direction: ${sortDirLabel}. Toggle to change.`}
            >
              {sortDirLabel}
            </Button>
            <YStack
              width={1}
              alignSelf='stretch'
              backgroundColor='$gray6'
              marginHorizontal='$2'
              minHeight={20}
            />
            <Popover>
              <Popover.Trigger asChild>
                <Button
                  size='$2'
                  theme='gray'
                  borderWidth={1}
                  borderColor='$gray6'
                  aria-label='Column visibility (opens menu)'
                >
                  <XStack
                    gap='$1'
                    alignItems='center'
                  >
                    <Text>Columns</Text>
                    <Text
                      fontSize='$1'
                      opacity={0.8}
                    >
                      ▾
                    </Text>
                  </XStack>
                </Button>
              </Popover.Trigger>
              <Popover.Content
                padding='$2'
                elevate
                borderWidth={1}
                borderColor='$gray4'
                enterStyle={{ opacity: 0, scale: 0.96 }}
                exitStyle={{ opacity: 0, scale: 0.96 }}
                aria-label='Column visibility'
              >
                <Popover.Arrow />
                <YStack
                  gap='$1'
                  minWidth={180}
                >
                  {KANBAN_STATUSES.map((status) => {
                    const isVisible =
                      kanbanPrefs.visibleStatuses.includes(status);
                    return (
                      <Button
                        key={status}
                        size='$2'
                        chromeless
                        justifyContent='flex-start'
                        backgroundColor={isVisible ? '$gray3' : 'transparent'}
                        borderWidth={1}
                        borderColor={isVisible ? '$gray5' : 'transparent'}
                        borderRadius='$2'
                        onPress={() => handleToggleStatus(status)}
                        aria-pressed={isVisible}
                        aria-label={`${status} column: ${isVisible ? 'visible' : 'hidden'}`}
                      >
                        <XStack
                          gap='$2'
                          alignItems='center'
                        >
                          <YStack
                            width={14}
                            height={14}
                            borderRadius='$1'
                            borderWidth={1}
                            borderColor='$gray8'
                            backgroundColor={
                              isVisible ? '$blue8' : 'transparent'
                            }
                            alignItems='center'
                            justifyContent='center'
                          >
                            {isVisible ? (
                              <Text
                                fontSize={10}
                                color='$white'
                              >
                                ✓
                              </Text>
                            ) : null}
                          </YStack>
                          <Text fontSize='$2'>{status}</Text>
                        </XStack>
                      </Button>
                    );
                  })}
                </YStack>
              </Popover.Content>
            </Popover>
          </XStack>
        </Toolbar>

        {prefsError ? (
          <Text
            fontSize='$2'
            color='$red10'
          >
            {prefsError}
          </Text>
        ) : null}
        <Separator />
        {isLoading ? (
          <MetaText>Loading tasks…</MetaText>
        ) : loadError ? (
          <Text
            fontSize='$2'
            color='$red10'
          >
            {loadError}
          </Text>
        ) : tasks.length === 0 ? (
          <MetaText
            padding='$3'
            textAlign='center'
            opacity={0.85}
          >
            No tasks in this view. Sync from Notion or run an ingest to see
            tasks.
          </MetaText>
        ) : (
          <ScrollView horizontal>
            <XStack gap='$3'>
              {visibleStatuses.map((status) => {
                const statusTasks = tasks.filter(
                  (task) => task.status === status,
                );
                const sortedTasks = sortTasks(
                  statusTasks,
                  kanbanPrefs.sortKey,
                  kanbanPrefs.sortDir,
                );
                return (
                  <KanbanColumn
                    key={status}
                    status={status}
                    tasks={sortedTasks}
                    onMoveTask={onMoveTask}
                  />
                );
              })}
            </XStack>
          </ScrollView>
        )}
      </Panel>
    </ScrollView>
  );
}
