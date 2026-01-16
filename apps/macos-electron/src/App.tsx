/**
 * Renderer root view for kanban + session drafts.
 *
 * Coordinates global refresh state and Notion bootstrap hooks.
 */
import { useEffect, useState } from 'react';
import { YStack } from 'tamagui';
import { AppHeader } from './components/AppHeader';
import { KanbanPanel } from './components/KanbanPanel';
import { SessionDrafts } from './components/SessionDrafts';
import { useAppStore } from './store/appStore';
import type { KanbanFilters, KanbanLayout } from './types/ui';
import { createDefaultKanbanFilters } from './utils/filters';
import { DEFAULT_ENABLED_KANBAN_STATUSES, toggleStatusList } from './utils/status';

/**
 * Root application view.
 */
function App() {
  const [filters, setFilters] = useState<KanbanFilters>(createDefaultKanbanFilters);
  const [kanbanLayout, setKanbanLayout] = useState<KanbanLayout>('comfortable');
  const [isRefreshingKanban, setIsRefreshingKanban] = useState(false);
  const [enabledKanbanStatuses, setEnabledKanbanStatuses] = useState<string[]>(
    DEFAULT_ENABLED_KANBAN_STATUSES,
  );

  const ipcAvailable = Boolean(window?.ipcRenderer?.invoke);
  const notionConnected = Boolean(useAppStore((state) => state.notionMirror.connected));
  const bootstrap = useAppStore((state) => state.bootstrap);
  const checkNotionStatus = useAppStore((state) => state.checkNotionStatus);
  const connectNotion = useAppStore((state) => state.connectNotion);
  const refreshKanban = useAppStore((state) => state.refreshKanban);

  useEffect(() => {
    if (!ipcAvailable) {
      console.warn('IPC not available; open the app in Electron to use Notion.');
      return;
    }
    checkNotionStatus()
      .then((connected) => {
        if (connected) {
          return bootstrap();
        }
        return undefined;
      })
      .catch((error) => console.error('Failed to bootstrap Notion mirror:', error));
  }, [bootstrap, checkNotionStatus, ipcAvailable]);

  const handleApplyFilters = async () => {
    setIsRefreshingKanban(true);
    try {
      await refreshKanban({
        project: filters.project || undefined,
        status: filters.status || undefined,
        dueDateRange:
          filters.dueStart || filters.dueEnd
            ? { start: filters.dueStart || undefined, end: filters.dueEnd || undefined }
            : undefined,
        createdAfter: filters.createdAfter || undefined,
      });
    } finally {
      setIsRefreshingKanban(false);
    }
  };

  const handleFiltersChange = (nextFilters: KanbanFilters) => {
    setFilters(nextFilters);
  };

  const handleLayoutChange = (nextLayout: KanbanLayout) => {
    setKanbanLayout(nextLayout);
  };

  const handleToggleStatus = (status: string) => {
    setEnabledKanbanStatuses((prev) => toggleStatusList(prev, status));
  };

  return (
    <YStack f={1} bg="$background" p="$4" gap="$4">
      <AppHeader
        ipcAvailable={ipcAvailable}
        isRefreshingKanban={isRefreshingKanban}
        notionConnected={notionConnected}
        onRefreshKanban={handleApplyFilters}
        onConnectNotion={connectNotion}
      />
      <SessionDrafts ipcAvailable={ipcAvailable} />
      <KanbanPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        layout={kanbanLayout}
        onLayoutChange={handleLayoutChange}
        enabledStatuses={enabledKanbanStatuses}
        onToggleStatus={handleToggleStatus}
        isRefreshing={isRefreshingKanban}
      />
    </YStack>
  );
}

export default App;
