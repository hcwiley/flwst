/**
 * Kanban filters and column toggle controls.
 *
 * Keeps filter input state controlled via props for the parent panel.
 */
import { Input, Switch, Text, XStack, YStack } from 'tamagui';
import type { KanbanFiltersProps } from '../types/ui';
import { normalizeStatus, statusEquals } from '../utils/status';

/**
 * Render filter inputs and status toggles.
 */
export function KanbanFilters({
  filters,
  onFiltersChange,
  statusOptions,
  enabledStatuses,
  onToggleStatus,
}: KanbanFiltersProps) {
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <>
      <XStack gap="$2">
        <Input
          size="$2"
          placeholder="Project"
          value={filters.project}
          onChangeText={(value) => handleFilterChange('project', value)}
        />
        <Input
          size="$2"
          placeholder="Status"
          value={filters.status}
          onChangeText={(value) => handleFilterChange('status', value)}
        />
        <Input
          size="$2"
          placeholder="Due start"
          value={filters.dueStart}
          onChangeText={(value) => handleFilterChange('dueStart', value)}
        />
        <Input
          size="$2"
          placeholder="Due end"
          value={filters.dueEnd}
          onChangeText={(value) => handleFilterChange('dueEnd', value)}
        />
        <Input
          size="$2"
          placeholder="Created after (YYYY-MM-DD)"
          value={filters.createdAfter}
          onChangeText={(value) => handleFilterChange('createdAfter', value)}
        />
      </XStack>
      <YStack gap="$2">
        <Text fontSize="$2" color="$color.gray11">
          Columns
        </Text>
        <XStack gap="$3" flexWrap="wrap">
          {statusOptions.map((status) => {
            const normalizedStatus = normalizeStatus(status);
            const isEnabled = enabledStatuses.some((enabled) =>
              statusEquals(enabled, normalizedStatus),
            );
            return (
              <XStack key={status} ai="center" gap="$2">
                <Switch
                  size="$2"
                  checked={isEnabled}
                  onCheckedChange={() => onToggleStatus(normalizedStatus)}
                />
                <Text fontSize="$2">{status}</Text>
              </XStack>
            );
          })}
        </XStack>
      </YStack>
    </>
  );
}
