import { useEffect, useMemo, useState } from 'react';
import {
  YStack,
  XStack,
  TextArea,
  Button,
  Text,
  ScrollView,
  Spinner,
  Input,
  Switch,
} from 'tamagui';
import type { NotionTodoCard } from '@flwst/types/src/api/reasoning';
import { TodoCard } from './components/TodoCard';
import { ProcessingStatus } from './components/ProcessingStatus';
import { Markdown } from './components/Markdown';
import { useAppStore } from './store/appStore';

/**
 * Renderer root view for Kanban + session drafts.
 */
function App() {
  const [transcript, setTranscript] = useState('');
  const [filters, setFilters] = useState(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 14);
    return {
      project: '',
      status: '',
      dueStart: '',
      dueEnd: '',
      createdAfter: defaultDate.toISOString().slice(0, 10),
    };
  });
  const [kanbanLayout, setKanbanLayout] = useState<'comfortable' | 'fit'>('comfortable');
  const [isRefreshingKanban, setIsRefreshingKanban] = useState(false);
  const [enabledKanbanStatuses, setEnabledKanbanStatuses] = useState<string[]>([
    'TODO',
    'On Deck',
    'In Progress',
    'Blocked',
    'BLOCKED',
  ]);
  // Default to preview so the Daily Note reads cleanly.
  const [dailyNoteView, setDailyNoteView] = useState<'preview' | 'raw'>('preview');
  const ipcAvailable = Boolean(window?.ipcRenderer?.invoke);
  const openExternal = (url?: string) => {
    if (!url) return;
    try {
      const openFn = globalThis?.shell?.openExternal;
      if (typeof openFn === 'function') {
        void openFn(url);
        return;
      }
    } catch (error) {
      console.warn('Failed to open external link:', error);
    }
    if (typeof globalThis?.open === 'function') {
      globalThis.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  const toggleKanbanStatus = (status: string) => {
    setEnabledKanbanStatuses((prev) =>
      prev.includes(status) ? prev.filter((value) => value !== status) : [...prev, status],
    );
  };

  const notionMirror = useAppStore((state) => state.notionMirror);
  const session = useAppStore((state) => state.session);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const checkNotionStatus = useAppStore((state) => state.checkNotionStatus);
  const connectNotion = useAppStore((state) => state.connectNotion);
  const refreshKanban = useAppStore((state) => state.refreshKanban);
  const ingestTranscript = useAppStore((state) => state.ingestTranscript);
  const updateDraftTodo = useAppStore((state) => state.updateDraftTodo);
  const updateDailyNote = useAppStore((state) => state.updateDailyNote);
  const submitAll = useAppStore((state) => state.submitAll);
  const submitOne = useAppStore((state) => state.submitOne);
  const clearSessionError = useAppStore((state) => state.clearSessionError);
  const clearSessionWarning = useAppStore((state) => state.clearSessionWarning);

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

  const groupedKanban = useMemo(() => {
    const columns: Record<string, NotionTodoCard[]> = {};
    const enabledStatusSet = new Set(enabledKanbanStatuses);
    const defaultOrder = ['TODO', 'On Deck', 'In Progress', 'Blocked', 'Backlog', 'Done', 'Cancelled'];
    const statuses =
      notionMirror.statuses.length > 0
        ? notionMirror.statuses.map((status) => status.name)
        : defaultOrder;
    const uniqueStatuses = Array.from(new Set(statuses));
    const statusOrder = new Map(defaultOrder.map((status, index) => [status, index]));
    uniqueStatuses.sort((a, b) => {
      const aIndex = statusOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = statusOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
    const visibleStatuses = uniqueStatuses.filter((status) => enabledStatusSet.has(status));

    for (const status of visibleStatuses) {
      columns[status] = [];
    }

    for (const item of notionMirror.kanbanItems) {
      const status = item.status || 'TODO';
      if (!enabledStatusSet.has(status)) continue;
      if (!columns[status]) columns[status] = [];
      columns[status].push(item);
    }

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
  }, [enabledKanbanStatuses, notionMirror.kanbanItems, notionMirror.statuses]);

  const handleProcess = async () => {
    if (!transcript.trim()) return;
    await ingestTranscript(transcript.trim());
  };

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

  const columnCount = Math.max(1, Object.keys(groupedKanban).length);
  const fitColumnWidth = `${100 / columnCount}%`;
  const columnWidth = kanbanLayout === 'fit' ? fitColumnWidth : 400;
  const isFit = kanbanLayout === 'fit';
  const columnGap = isFit ? 0 : '$3';

  return (
    <YStack f={1} bg="$background" p="$4" gap="$4">
      <XStack jc="space-between" ai="center">
        <Text fontSize="$6" fontWeight="bold">
          flwst
        </Text>
        <XStack gap="$2">
          <Button size="$2" onPress={handleApplyFilters} disabled={!ipcAvailable || isRefreshingKanban}>
            Refresh Kanban
          </Button>
          <Button
            size="$2"
            theme={notionMirror.connected ? 'green' : 'blue'}
            onPress={connectNotion}
            disabled={!ipcAvailable}
          >
            {notionMirror.connected ? 'Notion Connected' : 'Connect Notion'}
          </Button>
        </XStack>
      </XStack>
      {!ipcAvailable && (
        <Text color="$color.gray10">
          IPC not available. Open via Electron to use Notion features.
        </Text>
      )}

      {/* Session drawer */}
      <YStack gap="$3" p="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
        <Text fontSize="$4" fontWeight="bold">
          Session Drafts
        </Text>

        <TextArea
          value={transcript}
          onChangeText={setTranscript}
          placeholder="Paste transcript or notes..."
          bg="$backgroundHover"
        />

        <Button
          onPress={handleProcess}
          disabled={
            !transcript.trim() ||
            !ipcAvailable ||
            (session.processingPhase !== 'idle' && session.processingPhase !== 'done')
          }
          themeInverse
        >
          {session.processingPhase !== 'idle' && session.processingPhase !== 'done' ? (
            <XStack ai="center" gap="$2">
              <Spinner />
              <Text>Processing...</Text>
            </XStack>
          ) : (
            'Ingest Transcript'
          )}
        </Button>

        {(session.processingPhase !== 'idle' || session.error || session.warning) && (
          <ProcessingStatus
            phase={session.processingPhase}
            error={session.error ?? null}
            warning={session.warning ?? null}
            onDismissError={clearSessionError}
            onDismissWarning={clearSessionWarning}
          />
        )}

        {session.draftDailyNote && (
          <YStack gap="$2" p="$2" borderWidth={1} borderColor="$borderColor" borderRadius="$3">
            <XStack jc="space-between" ai="center">
              <Text fontWeight="bold">Daily Note</Text>
              <XStack ai="center" gap="$3">
                <XStack ai="center" gap="$2">
                  <Text
                    fontSize="$2"
                    color={dailyNoteView === 'preview' ? '$color' : '$color.gray10'}
                  >
                    Preview
                  </Text>
                  <Switch
                    size="$2"
                    checked={dailyNoteView === 'raw'}
                    onCheckedChange={(value) => setDailyNoteView(value ? 'raw' : 'preview')}
                  />
                  <Text fontSize="$2" color={dailyNoteView === 'raw' ? '$color' : '$color.gray10'}>
                    Raw
                  </Text>
                </XStack>
                <Button size="$2" theme="green" onPress={() => submitAll()}>
                  Submit All
                </Button>
              </XStack>
            </XStack>
            {dailyNoteView === 'raw' ? (
              <TextArea
                value={session.draftDailyNote.dailyNoteRichMarkdown}
                onChangeText={(value) => updateDailyNote({ dailyNoteRichMarkdown: value })}
                minHeight={120}
              />
            ) : (
              <Markdown content={session.draftDailyNote.dailyNoteRichMarkdown} />
            )}
          </YStack>
        )}

        <YStack gap="$3">
          {session.draftTodos.map((todo) => (
            <TodoCard
              key={todo.localId}
              todo={todo}
              projectOptions={notionMirror.projects}
              statusOptions={notionMirror.statuses}
              onUpdate={updateDraftTodo}
              onSubmitOne={submitOne}
            />
          ))}
        </YStack>
      </YStack>

      {/* Kanban + filters */}
      <YStack gap="$3" f={1}>
        <XStack jc="space-between" ai="center">
          <Text fontSize="$4" fontWeight="bold">
            Notion Kanban
          </Text>
          <XStack gap="$2">
            <Button
              size="$2"
              variant={kanbanLayout === 'comfortable' ? 'solid' : 'outlined'}
              onPress={() => setKanbanLayout('comfortable')}
            >
              Comfortable
            </Button>
            <Button
              size="$2"
              variant={kanbanLayout === 'fit' ? 'solid' : 'outlined'}
              onPress={() => setKanbanLayout('fit')}
            >
              Fit Columns
            </Button>
          </XStack>
        </XStack>
        <XStack gap="$2">
          <Input
            size="$2"
            placeholder="Project"
            value={filters.project}
            onChangeText={(value) => setFilters((prev) => ({ ...prev, project: value }))}
          />
          <Input
            size="$2"
            placeholder="Status"
            value={filters.status}
            onChangeText={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          />
          <Input
            size="$2"
            placeholder="Due start"
            value={filters.dueStart}
            onChangeText={(value) => setFilters((prev) => ({ ...prev, dueStart: value }))}
          />
          <Input
            size="$2"
            placeholder="Due end"
            value={filters.dueEnd}
            onChangeText={(value) => setFilters((prev) => ({ ...prev, dueEnd: value }))}
          />
          <Input
            size="$2"
            placeholder="Created after (YYYY-MM-DD)"
            value={filters.createdAfter}
            onChangeText={(value) => setFilters((prev) => ({ ...prev, createdAfter: value }))}
          />
        </XStack>
        <YStack gap="$2">
          <Text fontSize="$2" color="$color.gray11">
            Columns
          </Text>
          <XStack gap="$3" flexWrap="wrap">
            {(notionMirror.statuses.length > 0
              ? notionMirror.statuses.map((status) => status.name)
              : ['TODO', 'On Deck', 'In Progress', 'Blocked', 'Backlog', 'Done', 'Cancelled']
            ).map((status) => (
              <XStack key={status} ai="center" gap="$2">
                <Switch
                  size="$2"
                  checked={enabledKanbanStatuses.includes(status)}
                  onCheckedChange={() => toggleKanbanStatus(status)}
                />
                <Text fontSize="$2">{status}</Text>
              </XStack>
            ))}
          </XStack>
        </YStack>

        <YStack position="relative">
          <YStack
            borderWidth={1}
            borderColor="$borderColor"
            borderRadius="$3"
            p="$2"
            bg="$background"
            opacity={isRefreshingKanban ? 0.4 : 1}
            pointerEvents={isRefreshingKanban ? 'none' : 'auto'}
          >
            <ScrollView horizontal={!isFit} showsHorizontalScrollIndicator={!isFit}>
              <XStack gap={columnGap} ai="flex-start" width="100%" flexWrap="nowrap">
                {Object.entries(groupedKanban).map(([status, items]) => (
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
                    {items.length === 0 ? (
                      <Text fontSize="$2" color="$color.gray10">
                        No items
                      </Text>
                    ) : (
                      items.map((item) => (
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
          {isRefreshingKanban && (
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
      </YStack>
    </YStack>
  );
}

export default App;
