/**
 * Session drafts panel for transcript ingestion and task review.
 *
 * Owns transcript input UI and renders draft todos + daily note content.
 */
import { useState } from 'react';
import { Button, Spinner, Text, TextArea, XStack, YStack } from 'tamagui';
import { TodoCard } from './TodoCard';
import { ProcessingStatus } from './ProcessingStatus';
import { DailyNotePanel } from './DailyNotePanel';
import { useAppStore } from '../store/appStore';
import type { DailyNoteView, SessionDraftsProps } from '../types/ui';

/**
 * Render the session drafts section.
 */
export function SessionDrafts({ ipcAvailable }: SessionDraftsProps) {
  const [transcript, setTranscript] = useState('');
  // Default to preview so the Daily Note reads cleanly.
  const [dailyNoteView, setDailyNoteView] = useState<DailyNoteView>('preview');

  const notionMirror = useAppStore((state) => state.notionMirror);
  const session = useAppStore((state) => state.session);
  const ingestTranscript = useAppStore((state) => state.ingestTranscript);
  const updateDraftTodo = useAppStore((state) => state.updateDraftTodo);
  const updateDailyNote = useAppStore((state) => state.updateDailyNote);
  const submitAll = useAppStore((state) => state.submitAll);
  const submitOne = useAppStore((state) => state.submitOne);
  const clearSessionError = useAppStore((state) => state.clearSessionError);
  const clearSessionWarning = useAppStore((state) => state.clearSessionWarning);

  const isProcessing = session.processingPhase !== 'idle' && session.processingPhase !== 'done';
  const isIngestDisabled = !transcript.trim() || !ipcAvailable || isProcessing;

  const handleProcess = async () => {
    const trimmed = transcript.trim();
    if (!trimmed) return;
    await ingestTranscript(trimmed);
  };

  return (
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

      <Button onPress={handleProcess} disabled={isIngestDisabled} themeInverse>
        {isProcessing ? (
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
        <DailyNotePanel
          dailyNote={session.draftDailyNote}
          view={dailyNoteView}
          onViewChange={setDailyNoteView}
          onUpdate={updateDailyNote}
          onSubmitAll={() => void submitAll()}
        />
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
  );
}
