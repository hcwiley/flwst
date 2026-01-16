/**
 * Kanban board renderer for Notion tasks.
 *
 * Groups tasks by status, applies filters, and renders responsive columns.
 */
import { useMemo } from 'react';
import { Button, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import type { NotionTodoCard } from '@flwst/types/src/api/reasoning';
import type { KanbanBoardProps } from '../types/ui';
import { openExternal } from '../utils/openExternal';
import { DEFAULT_KANBAN_STATUSES, normalizeStatus } from '../utils/status';

/**
 * Build the grouped columns for the board view.
 */
function buildColumns(
  items: NotionTodoCard[],
  statuses: KanbanBoardProps['statuses'],
  enabledStatuses: string[],
): Record<string, NotionTodoCard[]> {
  const columns: Record<string, NotionTodoCard[]> = {};
  const normalizedEnabledStatuses = enabledStatuses.map(normalizeStatus);
  const enabledStatusSet = new Set(normalizedEnabledStatuses);
  const statusDisplayMap = new Map<string, string>();

  // Normalize status names for consistent ordering.
  const availableStatuses =
    statuses.length > 0
      ? statuses.map((status) => {
          const normalized = normalizeStatus(status.name);
          statusDisplayMap.set(normalized, status.name);
          return normalized;
        })
      : DEFAULT_KANBAN_STATUSES;

  const uniqueStatuses = Array.from(new Set(availableStatuses));
  const statusOrder = new Map(DEFAULT_KANBAN_STATUSES.map((status, index) => [status, index]));
  uniqueStatuses.sort((a, b) => {
    const aIndex = statusOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = statusOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });

  const visibleStatuses = uniqueStatuses.filter((status) => enabledStatusSet.has(status));
  for (const normalizedStatus of visibleStatuses) {
    const displayName = statusDisplayMap.get(normalizedStatus) || normalizedStatus;
    columns[displayName] = [];
  }

  for (const item of items) {
    const itemStatus = item.status || 'TODO';
    const normalizedItemStatus = normalizeStatus(itemStatus);
    if (!enabledStatusSet.has(normalizedItemStatus)) continue;

    const displayName = statusDisplayMap.get(normalizedItemStatus) || normalizedItemStatus;
    if (!columns[displayName]) columns[displayName] = [];
    columns[displayName].push(item);
  }

  // Sort items within each column by last edited time.
  for (const status of Object.keys(columns)) {
    columns[status]?.sort((a, b) => {
      const aTime = Date.parse(a.lastEditedTime ?? '');
      const bTime = Date.parse(b.lastEditedTime ?? '');
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
  }

  return columns;
}

/**
 * Render the board with columns and cards.
 */
export function KanbanBoard({
  items,
  statuses,
  enabledStatuses,
  layout,
  isRefreshing,
}: KanbanBoardProps) {
  const groupedKanban = useMemo(
    () => buildColumns(items, statuses, enabledStatuses),
    [enabledStatuses, items, statuses],
  );

  const columnCount = Math.max(1, Object.keys(groupedKanban).length);
  const fitColumnWidth = `${100 / columnCount}%`;
  const isFit = layout === 'fit';
  const columnWidth: number | string = isFit ? fitColumnWidth : 400;
  const columnGap = isFit ? 0 : '$3';

  return (
    <YStack position="relative">
      <YStack
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$3"
        p="$2"
        bg="$background"
        opacity={isRefreshing ? 0.4 : 1}
        pointerEvents={isRefreshing ? 'none' : 'auto'}
      >
        <ScrollView horizontal={!isFit} showsHorizontalScrollIndicator={!isFit}>
          <XStack gap={columnGap} ai="flex-start" width="100%" flexWrap="nowrap">
            {Object.entries(groupedKanban).map(([status, itemsForStatus]) => (
              <YStack
                key={status}
                flex={isFit ? 1 : undefined}
                flexBasis={isFit ? 0 : undefined}
                flexShrink={isFit ? 1 : 0}
                minWidth={isFit ? 0 : columnWidth}
                maxWidth={isFit ? undefined : columnWidth}
                width={isFit ? undefined : columnWidth}
                p="$2"
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$3"
                gap="$2"
              >
                <Text fontWeight="bold">{status}</Text>
                {itemsForStatus.length === 0 ? (
                  <Text fontSize="$2" color="$color.gray10">
                    No items
                  </Text>
                ) : (
                  itemsForStatus.map((item) => (
                    <YStack
                      key={item.id}
                      p="$2"
                      borderWidth={1}
                      borderColor="$borderColor"
                      borderRadius="$2"
                      gap="$1"
                    >
                      <XStack jc="space-between" ai="center" gap="$2" flexWrap="wrap">
                        <Text fontWeight="bold" flexShrink={1} minWidth={0}>
                          {item.title}
                        </Text>
                        {item.notionUrl && (
                          <Button
                            size="$1"
                            variant="outlined"
                            flexShrink={0}
                            onPress={() => openExternal(item.notionUrl)}
                          >
                            View
                          </Button>
                        )}
                      </XStack>
                      {item.project && <Text fontSize="$2">{item.project}</Text>}
                      {item.dueDate && (
                        <Text fontSize="$2" color="$color.gray10">
                          Due {item.dueDate}
                        </Text>
                      )}
                    </YStack>
                  ))
                )}
              </YStack>
            ))}
          </XStack>
        </ScrollView>
      </YStack>
      {isRefreshing && (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          ai="center"
          jc="center"
          bg="$background"
          opacity={0.7}
          borderRadius="$3"
        >
          <Spinner />
          <Text fontSize="$2" color="$color.gray11">
            Refreshing Kanban...
          </Text>
        </YStack>
      )}
    </YStack>
  );
}
