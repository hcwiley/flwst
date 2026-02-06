/**
 * Single task card for the Kanban board.
 * Shows source badge (Notion vs Pending); Notion tasks get a clickable link to open in browser.
 * Future: "Save to Notion" action for source === 'ingest' (see plan "Future integration points").
 */

import { Stack, Text, XStack } from 'tamagui';
import type { KanbanTaskDisplay } from './kanbanTypes';

interface KanbanTaskCardProps {
  task: KanbanTaskDisplay;
  status: string;
}

function openNotionUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function KanbanTaskCard({
  task,
  status: _status,
}: KanbanTaskCardProps): React.JSX.Element {
  const canDrag = task.source === 'notion';

  const handleDragStart = (event: React.DragEvent): void => {
    if (!canDrag || !task.id) return;
    const payload = JSON.stringify({ taskId: task.id, status: task.status });
    event.dataTransfer.setData('application/x-flwst-task', payload);
    event.dataTransfer.effectAllowed = 'move';
  };

  const titleNode =
    task.url != null ? (
      <Text
        fontWeight='600'
        fontSize='$3'
        color='$blue10'
        textDecorationLine='underline'
        cursor='pointer'
        hoverStyle={{ opacity: 0.8 }}
        onPress={() => openNotionUrl(task.url!)}
      >
        {task.name}
      </Text>
    ) : (
      <Text
        fontWeight='600'
        fontSize='$3'
      >
        {task.name}
      </Text>
    );

  return (
    <Stack
      padding='$2'
      borderWidth={1}
      borderColor='$gray3'
      borderRadius='$3'
      backgroundColor='$background'
      gap='$1'
      asChild
    >
      <div
        draggable={canDrag}
        onDragStart={handleDragStart}
        style={{
          cursor: canDrag ? 'grab' : 'not-allowed',
          opacity: canDrag ? 1 : 0.8,
        }}
      >
        <XStack
          justifyContent='space-between'
          alignItems='center'
          flexWrap='wrap'
          gap='$1'
        >
          {titleNode}
          <Stack
            paddingHorizontal='$2'
            paddingVertical='$1'
            borderRadius='$2'
            backgroundColor={task.source === 'notion' ? '$blue4' : '$yellow4'}
          >
            <Text
              fontSize='$1'
              fontWeight='600'
              color={task.source === 'notion' ? '$blue11' : '$yellow11'}
            >
              {task.source === 'notion' ? 'Notion' : 'Pending'}
            </Text>
          </Stack>
        </XStack>
        {task.project != null && task.project !== '' && (
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
          {task.due != null && task.due !== '' ? ` · Due: ${task.due}` : ''}
        </Text>
        {task.tags.length > 0 && (
          <Text
            fontSize='$2'
            opacity={0.7}
          >
            Tags: {task.tags.join(', ')}
          </Text>
        )}
      </div>
    </Stack>
  );
}
