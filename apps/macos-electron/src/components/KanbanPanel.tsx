/**
 * Kanban panel wrapper for layout controls, filters, and board.
 *
 * Keeps kanban UI concerns localized and wired to the store data.
 */
import { Button, Text, XStack, YStack } from 'tamagui';
import { useAppStore } from '../store/appStore';
import { KanbanBoard } from './KanbanBoard';
import { KanbanFilters } from './KanbanFilters';
import type { KanbanPanelProps } from '../types/ui';
import { DEFAULT_KANBAN_STATUSES } from '../utils/status';

/**
 * Render the Notion kanban section.
 */
export function KanbanPanel({
  filters,
  onFiltersChange,
  layout,
  onLayoutChange,
  enabledStatuses,
  onToggleStatus,
  isRefreshing,
}: KanbanPanelProps) {
  const notionMirror = useAppStore((state) => state.notionMirror);
  const statusOptions =
    notionMirror.statuses.length > 0
      ? notionMirror.statuses.map((status) => status.name)
      : DEFAULT_KANBAN_STATUSES;

  return (
    <YStack gap="$3" f={1}>
      <XStack jc="space-between" ai="center">
        <Text fontSize="$4" fontWeight="bold">
          Notion Kanban
        </Text>
        <XStack gap="$2">
          <Button
            size="$2"
            variant={layout === 'comfortable' ? 'solid' : 'outlined'}
            onPress={() => onLayoutChange('comfortable')}
          >
            Comfortable
          </Button>
          <Button
            size="$2"
            variant={layout === 'fit' ? 'solid' : 'outlined'}
            onPress={() => onLayoutChange('fit')}
          >
            Fit Columns
          </Button>
        </XStack>
      </XStack>

      <KanbanFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        statusOptions={statusOptions}
        enabledStatuses={enabledStatuses}
        onToggleStatus={onToggleStatus}
      />

      <KanbanBoard
        items={notionMirror.kanbanItems}
        statuses={notionMirror.statuses}
        enabledStatuses={enabledStatuses}
        layout={layout}
        isRefreshing={isRefreshing}
      />
    </YStack>
  );
}
