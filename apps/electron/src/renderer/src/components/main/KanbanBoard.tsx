/**
 * Kanban board rendering tasks grouped by core status columns.
 */

import { ScrollView, Text, XStack, Stack } from 'tamagui';
import type { TaskProps, TaskStatus } from '@flwst/types';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  tasks: TaskProps[];
  isLoading: boolean;
  loadError: string | null;
}

export function KanbanBoard({
  tasks,
  isLoading,
  loadError,
}: KanbanBoardProps): React.JSX.Element {
  const kanbanStatuses: TaskStatus[] = [
    'Backlog',
    'To-do',
    'On Deck',
    'In progress',
    'BLOCKED',
    'Done',
    'Cancelled',
  ];

  const statusMap: Record<string, TaskStatus> = {
    Backlog: 'Backlog',
    'To-do': 'To-do',
    TODO: 'To-do',
    'To Do': 'To-do',
    'On Deck': 'On Deck',
    'In progress': 'In progress',
    'In Progress': 'In progress',
    BLOCKED: 'BLOCKED',
    Blocked: 'BLOCKED',
    Done: 'Done',
    Cancelled: 'Cancelled',
    Canceled: 'Cancelled',
  };

  const normalizedTasks = tasks.map((task) => ({
    ...task,
    status: statusMap[task.status] ?? 'Backlog',
  }));

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
        {isLoading ? (
          <Text opacity={0.7}>Loading tasks…</Text>
        ) : loadError ? (
          <Text color='$red10'>{loadError}</Text>
        ) : (
          <ScrollView horizontal>
            <XStack gap='$3'>
              {kanbanStatuses.map((status) => {
                const statusTasks = normalizedTasks.filter(
                  (task) => task.status === status,
                );
                return (
                  <KanbanColumn
                    key={status}
                    status={status}
                    tasks={statusTasks}
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
