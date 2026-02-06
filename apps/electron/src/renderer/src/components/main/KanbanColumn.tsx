/**
 * Single Kanban column rendering tasks for a status.
 * Future: drag-and-drop "on move" handler will live here or on card wrapper.
 */

import { useCallback, useState } from 'react';
import { Text, YStack } from 'tamagui';
import type { TaskStatus } from '@flwst/types';
import type { KanbanTaskDisplay } from './kanbanTypes';
import { KanbanTaskCard } from './KanbanTaskCard';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: KanbanTaskDisplay[];
  onMoveTask: (taskId: string, status: TaskStatus) => void;
}

export function KanbanColumn({
  status,
  tasks,
  onMoveTask,
}: KanbanColumnProps): React.JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const payload = event.dataTransfer.getData('application/x-flwst-task');
      if (!payload) return;
      try {
        const parsed = JSON.parse(payload) as {
          taskId?: string;
          status?: TaskStatus;
        };
        if (!parsed.taskId) return;
        if (parsed.status === status) return;
        onMoveTask(parsed.taskId, status);
      } catch {
        // Ignore malformed drag payloads.
      }
    },
    [onMoveTask, status],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes('application/x-flwst-task')) return;
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <YStack
      width={240}
      padding='$3'
      borderWidth={1}
      borderColor={isDragOver ? '$blue8' : '$gray4'}
      borderRadius='$4'
      backgroundColor={isDragOver ? '$blue2' : '$gray1'}
      gap='$2'
      asChild
    >
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
      </div>
    </YStack>
  );
}
