/**
 * Collapsible vertical pane showing run status.
 * Collapses up/down; similar pattern to SettingsRail.
 */

import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Button, Stack, Text, YStack } from 'tamagui';
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
          <Text
            fontSize='$3'
            fontWeight='600'
          >
            Status:
          </Text>
          <Text
            fontSize='$3'
            color={statusColor}
          >
            {statusLabel}
          </Text>
          {lastRun && (
            <Text
              fontSize='$2'
              opacity={0.6}
            >
              ({lastRun.runId.slice(0, 8)}...)
            </Text>
          )}
        </Stack>
        <Stack
          flexDirection='row'
          alignItems='center'
          gap='$2'
        >
          {(error || lastRun) && (
            <Button
              size='$2'
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
            size='$2'
            onPress={toggleCollapsed}
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
          {lastRun && (
            <>
              <Text fontSize='$2'>Run ID: {lastRun.runId}</Text>
              <Text fontSize='$2'>Timestamp: {lastRun.timestamp}</Text>
              <Text fontSize='$2'>Filename: {lastRun.filename}</Text>
              <Text fontSize='$2'>
                LLM:{' '}
                {lastRun.llmSuccess
                  ? `Success (${lastRun.llmDurationMs}ms)`
                  : 'Failed'}
              </Text>
              {lastRun.llmSuccess && (
                <>
                  <Text fontSize='$2'>Daily Note: {lastRun.dailyNotePath}</Text>
                  <Text fontSize='$2'>Task Feed: {lastRun.taskFeedPath}</Text>
                </>
              )}
            </>
          )}
          {error && (
            <Text
              fontSize='$2'
              color='$red10'
            >
              Error: {error}
            </Text>
          )}
          {!lastRun && !error && (
            <Text
              fontSize='$2'
              opacity={0.6}
            >
              No runs yet. Drop a transcript to begin.
            </Text>
          )}
        </YStack>
      )}
    </Stack>
  );
}
