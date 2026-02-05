/**
 * Single Kanban column rendering tasks for a status.
 * Future: drag-and-drop "on move" handler will live here or on card wrapper.
 */

import { Text, YStack } from 'tamagui';
import type { TaskStatus } from '@flwst/types';
import type { KanbanTaskDisplay } from './kanbanTypes';
import { KanbanTaskCard } from './KanbanTaskCard';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: KanbanTaskDisplay[];
}

export function KanbanColumn({
  status,
  tasks,
}: KanbanColumnProps): React.JSX.Element {
  return (
    <YStack
      width={240}
      padding='$3'
      borderWidth={1}
      borderColor='$gray4'
      borderRadius='$4'
      backgroundColor='$gray1'
      gap='$2'
    >
      <Text fontWeight='600'>{status}</Text>
      {tasks.length === 0 ? (
        <Text opacity={0.6}>No tasks</Text>
      ) : (
        tasks.map((task, idx) => (
          <KanbanTaskCard
            key={task.id ?? `ingest-${task.name}-${idx}`}
            task={task}
            status={status}
          />
        ))
      )}
    </YStack>
  );
}
