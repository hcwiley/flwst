/**
 * Single Kanban column rendering tasks for a status.
 */

import { Text, YStack } from 'tamagui';
import type { TaskProps, TaskStatus } from '@flwst/types';
import { KanbanTaskCard } from './KanbanTaskCard';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskProps[];
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
        tasks.map((task) => (
          <KanbanTaskCard
            key={`${status}-${task.name}`}
            task={task}
            status={status}
          />
        ))
      )}
    </YStack>
  );
}
