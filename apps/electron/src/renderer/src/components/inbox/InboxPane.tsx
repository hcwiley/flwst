/**
 * Inbox pane: drop text files or paste transcript content for ingest.
 * Keeps UI state local while delegating ingestion to main process via IPC.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button, Spinner, Stack, Text, TextArea, YStack } from 'tamagui';
import type { UserConfig } from '@flwst/types';
import type { InboxIngestResult, IngestStatus } from './types';

interface InboxPaneProps {
  config: UserConfig | null;
}

const ALLOWED_EXTENSIONS = ['.txt', '.md'];
const DEFAULT_FILENAME = 'pasted-text';

function isAllowedTextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function InboxPane({ config }: InboxPaneProps): React.JSX.Element {
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<IngestStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastRun, setLastRun] = useState<InboxIngestResult | null>(null);

  const preprocessEnabled = !!config?.preprocess.enabled;

  const canIngest = useMemo(() => content.trim().length > 0, [content]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    setError(null);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (!isAllowedTextFile(file.name)) {
      setError('Only .txt or .md files are supported.');
      return;
    }

    try {
      setStatus('reading');
      const text = await file.text();
      setContent(text);
      setFilename(file.name);
      setStatus('idle');
    } catch (readError) {
      setStatus('error');
      setError(
        readError instanceof Error ? readError.message : 'Failed to read file',
      );
    }
  }, []);

  const handleClear = useCallback(() => {
    setContent('');
    setFilename(null);
    setError(null);
    setStatus('idle');
  }, []);

  const handleIngest = useCallback(async () => {
    if (!canIngest) {
      setError('Paste content or drop a text file before ingesting.');
      return;
    }

    setStatus('ingesting');
    setError(null);

    try {
      const result = await window.api.inbox.ingestText({
        filename: filename ?? DEFAULT_FILENAME,
        content,
      });
      setLastRun(result);
      setStatus('success');
    } catch (ingestError) {
      setStatus('error');
      setError(
        ingestError instanceof Error ? ingestError.message : 'Ingest failed',
      );
    }
  }, [canIngest, content, filename]);

  return (
    <Stack
      flex={1}
      padding='$4'
      gap='$3'
    >
      <Text
        fontSize='$8'
        fontWeight='bold'
      >
        Inbox
      </Text>

      <Text
        fontSize='$3'
        opacity={0.8}
      >
        Drop a transcript file or paste text below to ingest.
      </Text>

      {/* Drop zone for text files */}
      <Stack
        padding='$3'
        borderWidth={1}
        borderColor={isDragging ? '$blue8' : '$gray5'}
        backgroundColor={isDragging ? '$blue1' : '$gray2'}
        borderRadius='$3'
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Text
          fontSize='$3'
          opacity={0.9}
        >
          {isDragging ? 'Release to load file' : 'Drag and drop a .txt or .md'}
        </Text>
        {filename && (
          <Text
            fontSize='$3'
            opacity={0.7}
          >
            Loaded: {filename}
          </Text>
        )}
      </Stack>

      <YStack gap='$2'>
        <Text
          fontSize='$4'
          fontWeight='600'
        >
          Paste transcript
        </Text>
        <TextArea
          value={content}
          onChangeText={setContent}
          numberOfLines={12}
          padding='$2'
          fontSize='$3'
          placeholder='Paste transcript text here...'
        />
      </YStack>

      <Stack
        flexDirection='row'
        gap='$2'
        alignItems='center'
      >
        <Button
          size='$4'
          theme='active'
          onPress={handleIngest}
          disabled={
            !canIngest || status === 'ingesting' || status === 'reading'
          }
        >
          {status === 'ingesting' ? 'Ingesting…' : 'Ingest'}
        </Button>
        <Button
          size='$4'
          theme='gray'
          onPress={handleClear}
          disabled={status === 'ingesting' || status === 'reading'}
        >
          Clear
        </Button>
        {(status === 'ingesting' || status === 'reading') && (
          <Spinner size='small' />
        )}
      </Stack>

      <Text
        fontSize='$3'
        opacity={0.7}
      >
        Preprocess: {preprocessEnabled ? 'On' : 'Off'}
      </Text>

      {lastRun && (
        <Stack
          padding='$3'
          borderWidth={1}
          borderColor='$gray4'
          borderRadius='$3'
          gap='$1'
        >
          <Text
            fontSize='$4'
            fontWeight='600'
          >
            Last run
          </Text>
          <Text fontSize='$3'>Run ID: {lastRun.runId}</Text>
          <Text fontSize='$3'>Timestamp: {lastRun.timestamp}</Text>
          <Text fontSize='$3'>Filename: {lastRun.filename}</Text>
        </Stack>
      )}

      {error && (
        <Text
          color='$red10'
          fontSize='$3'
        >
          {error}
        </Text>
      )}
    </Stack>
  );
}
