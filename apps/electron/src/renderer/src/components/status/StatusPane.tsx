/**
 * Collapsible vertical pane showing run status.
 * Quiet footer typography; tertiary Copy button.
 */

import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Button, Stack, YStack } from 'tamagui';
import { MetaText } from '@flwst/ui';
import type { InboxIngestResult, IngestStatus } from '../inbox/types';

interface StatusPaneProps {
  status: IngestStatus;
  lastRun: InboxIngestResult | null;
  error: string | null;
  expandedHeight?: number;
  collapsedHeight?: number;
}

export function StatusPane({
  status,
  lastRun,
  error,
  expandedHeight = 200,
  collapsedHeight = 40,
}: StatusPaneProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>(
    'idle',
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const copyPayload = useMemo(() => {
    const lines = [`status=${status}`, `timestamp=${new Date().toISOString()}`];

    if (lastRun) {
      lines.push(
        `runId=${lastRun.runId}`,
        `runTimestamp=${lastRun.timestamp}`,
        `filename=${lastRun.filename}`,
        `llmSuccess=${lastRun.llmSuccess}`,
        `llmDurationMs=${lastRun.llmDurationMs}`,
        `llmRawPath=${lastRun.llmRawPath}`,
        `dailyNotePath=${lastRun.dailyNotePath}`,
        `taskFeedPath=${lastRun.taskFeedPath}`,
      );
    }

    if (error) {
      lines.push(`error=${error}`);
    }

    return lines.join('\n');
  }, [error, lastRun, status]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopyState('success');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 1500);
    }
  }, [copyPayload]);

  const statusLabel = {
    idle: 'Ready',
    reading: 'Reading file...',
    ingesting: 'Preprocessing...',
    generating: 'Generating with LLM...',
    success: 'Complete',
    error: 'Error',
  }[status];

  const statusColor =
    status === 'error'
      ? '$red10'
      : status === 'success'
        ? '$green10'
        : '$gray11';

  return (
    <Stack
      height={collapsed ? collapsedHeight : expandedHeight}
      borderTopWidth={1}
      borderColor='$gray4'
      backgroundColor='$background'
      overflow='hidden'
    >
      <Stack
        flexDirection='row'
        alignItems='center'
        justifyContent='space-between'
        padding='$2'
        paddingHorizontal='$3'
      >
        <Stack
          flexDirection='row'
          alignItems='center'
          gap='$2'
        >
          <MetaText>Status:</MetaText>
          <MetaText color={statusColor}>{statusLabel}</MetaText>
          {lastRun ? (
            <MetaText opacity={0.6}>({lastRun.runId.slice(0, 8)}...)</MetaText>
          ) : null}
        </Stack>
        <Stack
          flexDirection='row'
          alignItems='center'
          gap='$2'
        >
          {(error || lastRun) && (
            <Button
              size='$1'
              theme={copyState === 'error' ? 'red' : 'gray'}
              onPress={handleCopy}
            >
              {copyState === 'success'
                ? 'Copied'
                : copyState === 'error'
                  ? 'Copy failed'
                  : 'Copy'}
            </Button>
          )}
          <Button
            size='$1'
            theme='gray'
            onPress={toggleCollapsed}
            aria-label={collapsed ? 'Expand status' : 'Collapse status'}
          >
            {collapsed ? '▲' : '▼'}
          </Button>
        </Stack>
      </Stack>

      {!collapsed && (
        <YStack
          padding='$3'
          gap='$2'
          flex={1}
          overflow='scroll'
        >
          {lastRun ? (
            <>
              <MetaText>Run ID: {lastRun.runId}</MetaText>
              <MetaText>Timestamp: {lastRun.timestamp}</MetaText>
              <MetaText>Filename: {lastRun.filename}</MetaText>
              <MetaText>
                LLM:{' '}
                {lastRun.llmSuccess
                  ? `Success (${lastRun.llmDurationMs}ms)`
                  : 'Failed'}
              </MetaText>
              {lastRun.llmSuccess ? (
                <>
                  <MetaText>Daily Note: {lastRun.dailyNotePath}</MetaText>
                  <MetaText>Task Feed: {lastRun.taskFeedPath}</MetaText>
                </>
              ) : null}
            </>
          ) : null}
          {error ? <MetaText color='$red10'>Error: {error}</MetaText> : null}
          {!lastRun && !error ? (
            <MetaText opacity={0.6}>
              No runs yet. Drop a transcript to begin.
            </MetaText>
          ) : null}
        </YStack>
      )}
    </Stack>
  );
}
