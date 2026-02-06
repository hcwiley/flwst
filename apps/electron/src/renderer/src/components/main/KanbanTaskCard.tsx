/**
 * Single task card for the Kanban board.
 * AppCard with title, source Pill, project/meta, and tag Pills.
 * Notion tasks: clickable title opens in browser; draggable.
 */

import { XStack } from 'tamagui';
import { AppCard, BodyText, MetaText, Pill } from '@flwst/ui';
import type { KanbanTaskDisplay } from './kanbanTypes';

interface KanbanTaskCardProps {
  task: KanbanTaskDisplay;
  status: string;
}

function openNotionUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Max lines for tag row to avoid layout jitter. */
const TAG_MAX_LINES = 2;

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
      <BodyText
        fontWeight='600'
        fontSize='$3'
        color='$blue10'
        textDecorationLine='underline'
        cursor='pointer'
        hoverStyle={{ opacity: 0.8 }}
        onPress={() => openNotionUrl(task.url!)}
      >
        {task.name}
      </BodyText>
    ) : (
      <BodyText
        fontWeight='600'
        fontSize='$3'
      >
        {task.name}
      </BodyText>
    );

  return (
    <AppCard asChild>
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
          <XStack
            flex={1}
            minWidth={0}
          >
            {titleNode}
          </XStack>
          <Pill
            label={task.source === 'notion' ? 'Notion' : 'Pending'}
            bg={task.source === 'notion' ? '$blue4' : '$yellow4'}
            color={task.source === 'notion' ? '$blue11' : '$yellow11'}
          />
        </XStack>
        {task.project != null && task.project !== '' ? (
          <MetaText>{task.project}</MetaText>
        ) : null}
        <XStack
          gap='$2'
          flexWrap='wrap'
          alignItems='center'
        >
          <MetaText>
            Priority: {task.priority}
            {task.due != null && task.due !== '' ? ` · Due: ${task.due}` : ''}
          </MetaText>
        </XStack>
        {task.tags.length > 0 ? (
          <XStack
            flexWrap='wrap'
            gap='$1'
            maxHeight={TAG_MAX_LINES * 24}
            overflow='hidden'
          >
            {task.tags.slice(0, 6).map((tag) => (
              <Pill
                key={tag}
                label={tag}
              />
            ))}
            {task.tags.length > 6 ? (
              <Pill label={`+${task.tags.length - 6}`} />
            ) : null}
          </XStack>
        ) : null}
      </div>
    </AppCard>
  );
}
