/**
 * Sync button: triggers Notion sync and shows syncing state / last sync time / error.
 * Placed in top-right of MainLayout; disables while in-flight and surfaces errors.
 */

import { track } from '@flwst/integrations';
import { useCallback, useEffect } from 'react';
import { Button, Spinner, Stack, Text } from 'tamagui';
import { useAppStore } from '@flwst/state';
import type { NotionTaskPage, NotionDailyNotePage } from '@flwst/types';

function formatLastSync(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function SyncButton(): React.JSX.Element {
  const isSyncing = useAppStore((s) => s.notionSync.isSyncing);
  const lastSyncAt = useAppStore((s) => s.notionSync.lastSyncAt);
  const lastError = useAppStore((s) => s.notionSync.lastError);
  const startSync = useAppStore((s) => s.startSync);
  const completeSync = useAppStore((s) => s.completeSync);
  const failSync = useAppStore((s) => s.failSync);

  useEffect(() => {
    const unsubscribe = window.api.notion.onSyncComplete((payload) => {
      if (payload.success && payload.tasks && payload.notes) {
        completeSync(
          payload.tasks as NotionTaskPage[],
          payload.notes as NotionDailyNotePage[],
        );
      } else if (!payload.success && payload.error) {
        failSync({ message: payload.error, at: new Date().toISOString() });
      }
    });
    return unsubscribe;
  }, [completeSync, failSync]);

  const handleSync = useCallback(() => {
    if (isSyncing) return;
    track('Sync from Notion', { source: 'button' });
    startSync();
    void window.api.notion.sync();
  }, [isSyncing, startSync]);

  const lastSyncLabel = formatLastSync(lastSyncAt);
  const errorLabel = lastError ? lastError.message : null;

  return (
    <Stack
      flexDirection='row'
      alignItems='center'
      gap='$2'
    >
      {lastSyncLabel ? (
        <Text
          fontSize='$2'
          color='$gray10'
        >
          Synced {lastSyncLabel}
        </Text>
      ) : null}
      {errorLabel ? (
        <Text
          fontSize='$2'
          color='$red10'
          numberOfLines={1}
        >
          {errorLabel}
        </Text>
      ) : null}
      <Button
        size='$3'
        theme='active'
        disabled={isSyncing}
        onPress={handleSync}
        icon={isSyncing ? <Spinner size='small' /> : undefined}
      >
        {isSyncing ? 'Syncing…' : 'Sync'}
      </Button>
    </Stack>
  );
}
