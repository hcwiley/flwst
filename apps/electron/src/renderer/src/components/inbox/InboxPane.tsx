/**
 * Inbox pane: drop text files or paste transcript content for ingest.
 * Keeps UI state local while delegating ingestion to main process via IPC.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button, Spinner, Stack, TextArea, YStack } from 'tamagui';
import { H1, H2, MetaText, Panel } from '@flwst/ui';
import type { UserConfig } from '@flwst/types';
import type { InboxIngestResult, IngestStatus } from './types';

interface InboxPaneProps {
  config: UserConfig | null;
  onStatusChange: (status: IngestStatus) => void;
  onRunComplete: (result: InboxIngestResult) => void;
  onError: (error: string | null) => void;
}

const ALLOWED_EXTENSIONS = ['.txt', '.md'];
const DEFAULT_FILENAME = 'pasted-text';

function isAllowedTextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function InboxPane({
  config,
  onStatusChange,
  onRunComplete,
  onError,
}: InboxPaneProps): React.JSX.Element {
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const preprocessEnabled = !!config?.preprocess.enabled;

  const canIngest = useMemo(() => content.trim().length > 0, [content]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      onError(null);

      const file = event.dataTransfer.files?.[0];
      if (!file) return;

      if (!isAllowedTextFile(file.name)) {
        onError('Only .txt or .md files are supported.');
        return;
      }

      try {
        onStatusChange('reading');
        const text = await file.text();
        setContent(text);
        setFilename(file.name);
        onStatusChange('idle');
      } catch (readError) {
        onStatusChange('error');
        onError(
          readError instanceof Error
            ? readError.message
            : 'Failed to read file',
        );
      }
    },
    [onError, onStatusChange],
  );

  const handleClear = useCallback(() => {
    setContent('');
    setFilename(null);
    onError(null);
    onStatusChange('idle');
  }, [onError, onStatusChange]);

  const handleIngest = useCallback(async () => {
    if (!canIngest || isProcessing) {
      if (!canIngest) {
        onError('Paste content or drop a text file before ingesting.');
      }
      return;
    }

    setIsProcessing(true);
    onStatusChange('ingesting');
    onError(null);

    try {
      const result = await window.api.inbox.ingestText({
        filename: filename ?? DEFAULT_FILENAME,
        content,
      });
      onRunComplete(result);
      onStatusChange(result.llmSuccess ? 'success' : 'error');
      if (!result.llmSuccess && result.llmError) {
        onError(result.llmError);
      }
    } catch (ingestError) {
      onStatusChange('error');
      onError(
        ingestError instanceof Error ? ingestError.message : 'Ingest failed',
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    canIngest,
    isProcessing,
    content,
    filename,
    onStatusChange,
    onRunComplete,
    onError,
  ]);

  return (
    <Panel
      flex={1}
      overflow='hidden'
      padding='$4'
      gap='$3'
    >
      <Stack
        style={{ position: 'sticky', top: 0, zIndex: 1 }}
        backgroundColor='$gray2'
        paddingBottom='$2'
      >
        <H1>Inbox</H1>
      </Stack>
      <MetaText>Drop a transcript file or paste text below to ingest.</MetaText>

      {/* Drop zone for text files (div for DOM drag events in Electron renderer) */}
      <Stack
        padding='$3'
        borderWidth={1}
        borderColor={isDragging ? '$blue8' : '$gray5'}
        backgroundColor={isDragging ? '$blue1' : '$gray2'}
        borderRadius='$3'
      >
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{ minHeight: 44 }}
        >
          <MetaText opacity={0.9}>
            {isDragging
              ? 'Release to load file'
              : 'Drag and drop a .txt or .md'}
          </MetaText>
          {filename && <MetaText opacity={0.7}>Loaded: {filename}</MetaText>}
        </div>
      </Stack>

      <YStack gap='$2'>
        <H2 fontSize='$4'>Paste transcript</H2>
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
          disabled={!canIngest || isProcessing}
        >
          {isProcessing ? 'Ingesting…' : 'Ingest'}
        </Button>
        <Button
          size='$4'
          theme='gray'
          onPress={handleClear}
          disabled={isProcessing}
        >
          Clear
        </Button>
        {isProcessing && <Spinner size='small' />}
      </Stack>

      <MetaText>Preprocess: {preprocessEnabled ? 'On' : 'Off'}</MetaText>
    </Panel>
  );
}
