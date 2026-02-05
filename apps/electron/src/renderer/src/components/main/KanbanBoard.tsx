/**
 * Kanban board rendering tasks grouped by core status columns.
 * Tasks are pre-normalized to KanbanTaskDisplay (status already normalized).
 */

import { ScrollView, Stack, Text, XStack } from 'tamagui';
import type { TaskStatus } from '@flwst/types';
import type { KanbanTaskDisplay } from './kanbanTypes';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  tasks: KanbanTaskDisplay[];
  isLoading: boolean;
  loadError: string | null;
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

export function KanbanBoard({
  tasks,
  isLoading,
  loadError,
}: KanbanBoardProps): React.JSX.Element {
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
              {KANBAN_STATUSES.map((status) => {
                const statusTasks = tasks.filter(
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
