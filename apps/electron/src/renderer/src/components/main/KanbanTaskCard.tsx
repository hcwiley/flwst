/**
 * Single task card for the Kanban board.
 */

import { Stack, Text } from 'tamagui';
import type { TaskProps } from '@flwst/types';

interface KanbanTaskCardProps {
  task: TaskProps;
  status: string;
}

export function KanbanTaskCard({
  task,
  status,
}: KanbanTaskCardProps): React.JSX.Element {
  return (
    <Stack
      key={`${status}-${task.name}`}
      padding='$2'
      borderWidth={1}
      borderColor='$gray3'
      borderRadius='$3'
      backgroundColor='$background'
      gap='$1'
    >
      <Text fontWeight='600' fontSize='$3'>{task.name}</Text>
      {task.project && (
        <Text
          fontSize='$2'
          opacity={0.7}
        >
          {task.project}
        </Text>
      )}
      <Text
        fontSize='$2'
        opacity={0.7}
      >
        Priority: {task.priority}
        {task.due ? ` · Due: ${task.due}` : ''}
      </Text>
      {task.tags.length > 0 && (
        <Text
          fontSize='$2'
          opacity={0.7}
        >
          Tags: {task.tags.join(', ')}
        </Text>
      )}
    </Stack>
  );
}
