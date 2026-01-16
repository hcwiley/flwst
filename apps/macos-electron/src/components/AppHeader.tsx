/**
 * Application header showing global actions and connectivity status.
 *
 * Keeps top-level controls visible without coupling to app state shape.
 */
import { Button, Text, XStack, YStack } from 'tamagui';
import type { AppHeaderProps } from '../types/ui';

/**
 * Render the top bar with Notion actions.
 */
export function AppHeader({
  ipcAvailable,
  isRefreshingKanban,
  notionConnected,
  onRefreshKanban,
  onConnectNotion,
}: AppHeaderProps) {
  return (
    <YStack gap="$2">
      <XStack jc="space-between" ai="center">
        <Text fontSize="$6" fontWeight="bold">
          flwst
        </Text>
        <XStack gap="$2">
          <Button
            size="$2"
            onPress={onRefreshKanban}
            disabled={!ipcAvailable || isRefreshingKanban}
          >
            Refresh Kanban
          </Button>
          <Button
            size="$2"
            theme={notionConnected ? 'green' : 'blue'}
            onPress={onConnectNotion}
            disabled={!ipcAvailable}
          >
            {notionConnected ? 'Notion Connected' : 'Connect Notion'}
          </Button>
        </XStack>
      </XStack>
      {!ipcAvailable && (
        <Text color="$color.gray10">
          IPC not available. Open via Electron to use Notion features.
        </Text>
      )}
    </YStack>
  );
}
