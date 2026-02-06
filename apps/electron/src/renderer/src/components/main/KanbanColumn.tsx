/**
 * Single Kanban column rendering tasks for a status.
 * Panel container with sticky header (title + count), internal scroll for cards.
 * Drag-and-drop drop target for moving tasks between columns.
 */

import { useCallback, useState } from 'react';
import { ScrollView, YStack } from 'tamagui';
import { H2, MetaText, Panel, Pill } from '@flwst/ui';
import type { TaskStatus } from '@flwst/types';
import type { KanbanTaskDisplay } from './kanbanTypes';
import { KanbanTaskCard } from './KanbanTaskCard';

/** Max height for column body so it scrolls internally. */
const COLUMN_BODY_MAX_HEIGHT = 420;

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
    <Panel
      width={240}
      flexShrink={0}
      padding='$3'
      gap='$2'
      borderColor={isDragOver ? '$blue8' : '$gray4'}
      backgroundColor={isDragOver ? '$blue2' : '$gray2'}
    >
      <YStack
        flex={1}
        minHeight={0}
        asChild
      >
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          }}
        >
          <YStack
            flexShrink={0}
            zIndex={1}
            backgroundColor={isDragOver ? '$blue2' : '$gray2'}
            paddingBottom='$2'
            flexDirection='row'
            alignItems='center'
            gap='$2'
            style={{ position: 'sticky', top: 0 } as React.CSSProperties}
          >
            <H2
              fontSize='$4'
              flex={1}
            >
              {status}
            </H2>
            <Pill label={String(tasks.length)} />
          </YStack>
          <ScrollView
            maxHeight={COLUMN_BODY_MAX_HEIGHT}
            flex={1}
          >
            <YStack
              gap='$2'
              paddingRight='$1'
            >
              {tasks.length === 0 ? (
                <MetaText>No tasks</MetaText>
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
          </ScrollView>
        </div>
      </YStack>
    </Panel>
  );
}
