/**
 * Kanban board rendering tasks grouped by core status columns.
 * Tasks are pre-normalized to KanbanTaskDisplay (status already normalized).
 */

import { useCallback, useState } from 'react';
import { Button, ScrollView, Stack, Text, XStack } from 'tamagui';
import { useAppStore } from '@flwst/state';
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

export function KanbanBoard({
  tasks,
  isLoading,
  loadError,
  onMoveTask,
}: KanbanBoardProps): React.JSX.Element {
  const kanbanPrefs = useAppStore((s) => s.kanbanPrefs);
  const setKanbanPrefs = useAppStore((s) => s.setKanbanPrefs);
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

  return (
    <ScrollView>
      <Stack
        flex={1}
        borderWidth={1}
        borderColor='$gray4'
        borderRadius='$4'
        backgroundColor='$gray1'
        padding='$3'
        overflow='scroll'
      >
        <Text
          fontSize='$6'
          fontWeight='600'
        >
          Kanban
        </Text>
        <XStack
          gap='$2'
          alignItems='center'
          flexWrap='wrap'
        >
          <Text
            fontSize='$2'
            opacity={0.7}
          >
            Sort
          </Text>
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.key}
              size='$2'
              theme={kanbanPrefs.sortKey === option.key ? 'active' : undefined}
              onPress={() => handleSortKey(option.key)}
            >
              {option.label}
            </Button>
          ))}
          <Button
            size='$2'
            onPress={handleSortDir}
          >
            {kanbanPrefs.sortDir === 'asc' ? 'Asc' : 'Desc'}
          </Button>
        </XStack>
        <XStack
          gap='$2'
          alignItems='center'
          flexWrap='wrap'
        >
          <Text
            fontSize='$2'
            opacity={0.7}
          >
            Columns
          </Text>
          {KANBAN_STATUSES.map((status) => (
            <Button
              key={status}
              size='$2'
              theme={
                kanbanPrefs.visibleStatuses.includes(status)
                  ? 'active'
                  : undefined
              }
              onPress={() => handleToggleStatus(status)}
            >
              {status}
            </Button>
          ))}
        </XStack>
        {prefsError && (
          <Text
            fontSize='$2'
            color='$red10'
          >
            {prefsError}
          </Text>
        )}
        {isLoading ? (
          <Text opacity={0.7}>Loading tasks…</Text>
        ) : loadError ? (
          <Text color='$red10'>{loadError}</Text>
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
      </Stack>
    </ScrollView>
  );
}
