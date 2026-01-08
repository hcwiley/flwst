import { useState, useEffect } from 'react';
import { YStack, XStack, TextArea, Button, Text, ScrollView, Spinner } from 'tamagui';
import {
  DailyNoteResponse,
  NotionContextResponse,
  Todo,
  HighLevelNotes,
} from '@flwst/types/api/reasoning';
import { TodoCard } from './components/TodoCard';
import { ProcessingStatus } from './components/ProcessingStatus.tsx';
import { Markdown } from './components/Markdown';

/**
 * Phase 2 response type: enriched todos with optional warning
 */
type NotionMatchResponse = {
  todos: Todo[];
  warning?: string;
};

/**
 * Processing phase state machine
 */
type ProcessingPhase =
  | 'idle'
  | 'fetching'
  | 'analyzing'
  | 'reasoning'
  | 'matching'
  | 'done'
  | 'submitting'
  | 'error';

function App() {
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase] = useState<ProcessingPhase>('idle');
  const [result, setResult] = useState<DailyNoteResponse | null>(null);
  const [highLevelNotes, setHighLevelNotes] = useState<HighLevelNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [context, setContext] = useState<NotionContextResponse | null>(null);
  const [notionConnected, setNotionConnected] = useState(false);
  const [isFetchingContext, setIsFetchingContext] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Check Notion connection status and fetch context if connected
  useEffect(() => {
    const checkStatusAndFetchContext = async () => {
      try {
        const statusRes = await fetch('http://localhost:3000/api/notion/status');
        const statusData = await statusRes.json();
        setNotionConnected(statusData.connected);

        if (statusData.connected && !context && !isFetchingContext) {
          setIsFetchingContext(true);
          try {
            const contextData = await handleFetchNotionContext();
            setContext(contextData);
          } finally {
            setIsFetchingContext(false);
          }
        }
      } catch (err) {
        console.error('Failed to check Notion status/context:', err);
      }
    };

    checkStatusAndFetchContext();
    // Re-check when window regains focus
    window.addEventListener('focus', checkStatusAndFetchContext);
    return () => window.removeEventListener('focus', checkStatusAndFetchContext);
  }, [context, isFetchingContext]);

  const handleConnectNotion = () => {
    window.open('http://localhost:3000/api/notion/oauth/authorize', '_blank');
  };

  /**
   * Phase 0: Fetch lightweight Notion context to help the LLM classify todos.
   */
  const handleFetchNotionContext = async (): Promise<NotionContextResponse> => {
    const response = await fetch('http://localhost:3000/api/notion/context?seed=a&limit=50', {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch Notion context');
    }

    const data: NotionContextResponse = await response.json();
    return data;
  };

  /**
   * Phase 1a: Extract high-level notes (Topics & Intent)
   */
  const handleHighLevel = async (
    transcriptText: string,
    context: NotionContextResponse | null,
  ): Promise<HighLevelNotes> => {
    setPhase('analyzing');
    setError(null);

    const response = await fetch('http://localhost:3000/api/process/high-level', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript: transcriptText, notionContext: context ?? undefined }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to analyze transcript');
    }

    const data: HighLevelNotes = await response.json();
    return data;
  };

  /**
   * Phase 1b: Process transcript with LLM (uses high-level notes and Notion context)
   */
  const handleReasoning = async (
    transcriptText: string,
    context: NotionContextResponse | null,
    highLevelNotes?: HighLevelNotes,
  ): Promise<DailyNoteResponse> => {
    setPhase('reasoning');
    setError(null);

    const response = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: transcriptText,
        notionContext: context ?? undefined,
        highLevelNotes,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to process transcript');
    }

    const data: DailyNoteResponse = await response.json();
    return data;
  };

  /**
   * Phase 2: Match todos with Notion tasks
   */
  const handlePhase2 = async (todos: Todo[]): Promise<NotionMatchResponse> => {
    setPhase('matching');
    setWarning(null);

    const response = await fetch('http://localhost:3000/api/notion/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ todos }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Phase 2 failures are non-blocking - we'll show a warning
      throw new Error(errorData.error || 'Failed to match todos with Notion');
    }

    const data: NotionMatchResponse = await response.json();
    return data;
  };

  /**
   * Phase 3: Submit to Notion
   */
  const handleSubmitToNotion = async () => {
    if (!result || phase === 'submitting') return;

    setPhase('submitting');
    setError(null);

    try {
      const response = await fetch('http://localhost:3000/api/notion/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dailyNoteRichMarkdown: result.dailyNoteRichMarkdown,
          todos: result.todos,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit to Notion');
      }

      const data = await response.json();
      console.log('Submission result:', data);
      setIsSubmitted(true);
      setPhase('done');
    } catch (err: any) {
      console.error('Submission failed:', err);
      setError(err.message || 'Failed to submit to Notion');
      setPhase('error');
    }
  };

  /**
   * Main process handler: runs Phase 1a, Phase 1b, then Phase 2
   */
  const handleProcess = async () => {
    if (!transcript.trim()) return;

    try {
      // Phase 1a UI: show Analyzing
      setPhase('analyzing');
      setError(null);
      setWarning(null);
      setHighLevelNotes(null); // Clear previous
      setResult(null); // Clear previous
      setIsSubmitted(false);

      // Phase 1a: High-level notes
      const notes = await handleHighLevel(transcript.trim(), context);
      setHighLevelNotes(notes);

      // Phase 1b: Reasoning (LLM) - uses already fetched context and high-level notes
      const phase1Result = await handleReasoning(transcript.trim(), context, notes);

      // Update UI with Phase 1 results immediately
      setResult({
        dailyNoteRichMarkdown: phase1Result.dailyNoteRichMarkdown,
        todos: phase1Result.todos,
        discoveredTodos: phase1Result.discoveredTodos,
      });

      // Phase 2: Match with Notion (non-blocking - if it fails, we keep Phase 1 results)
      try {
        const phase2Result = await handlePhase2(phase1Result.todos);

        // Update todos with enriched data
        setResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            todos: phase2Result.todos,
          };
        });

        // Show warning if present
        if (phase2Result.warning) {
          setWarning(phase2Result.warning);
        }

        setPhase('done');
      } catch (phase2Error) {
        // Phase 2 failure is non-blocking - show warning but keep Phase 1 results
        console.warn('Phase 2 (Notion matching) failed:', phase2Error);
        setWarning(
          phase2Error instanceof Error
            ? phase2Error.message
            : 'Notion matching unavailable; showing LLM results only',
        );
        setPhase('done');
      }
    } catch (phase1Error) {
      // Phase 1 failure is blocking - show error and don't render results
      console.error('Phase 1 (LLM processing) failed:', phase1Error);
      setError(phase1Error instanceof Error ? phase1Error.message : 'Failed to process transcript');
      setPhase('error');
      setResult(null);
    }
  };

  const isProcessing =
    phase !== 'idle' && phase !== 'done' && phase !== 'error' && phase !== 'submitting';

  return (
    <YStack f={1} bg="$background" p="$4" gap="$4">
      <XStack jc="space-between" ai="center">
        <Text fontSize="$6" fontWeight="bold">
          flwst
        </Text>
        <Button
          size="$2"
          theme={notionConnected ? 'green' : 'blue'}
          onPress={handleConnectNotion}
          icon={notionConnected ? undefined : <Spinner size="small" />}
        >
          {notionConnected ? 'Notion Connected' : 'Connect Notion'}
        </Button>
      </XStack>

      <XStack gap="$4" f={1}>
        <YStack f={1} gap="$4">
          <Text fontSize="$4">Input Transcript</Text>
          <TextArea
            f={1}
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Paste your transcript here..."
            bg="$backgroundHover"
          />
          <Button
            onPress={handleProcess}
            disabled={isProcessing || !transcript.trim()}
            themeInverse
          >
            {isProcessing ? <Spinner /> : 'Process'}
          </Button>
        </YStack>

        <YStack f={1} gap="$4" blw={1} blc="$borderColor" pl="$4">
          <Text fontSize="$4">Result</Text>

          {/* Processing status indicator */}
          {(isProcessing || phase === 'done' || phase === 'error' || warning) && (
            <ProcessingStatus
              phase={phase}
              error={error}
              warning={warning}
              onDismissError={() => {
                setError(null);
                setPhase('idle');
              }}
              onDismissWarning={() => setWarning(null)}
            />
          )}

          {/* High-level analysis results (only shown while detailed reasoning is in progress) */}
          {highLevelNotes && !result && (
            <YStack
              gap="$2"
              padding="$3"
              backgroundColor="$blue2"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$blue5"
            >
              <Text fontSize="$4" fontWeight="bold" color="$blue11">
                Interim Analysis
              </Text>
              <Markdown content={highLevelNotes.dailyNoteRichMarkdown} />
              <YStack gap="$1" mt="$2" bt={1} btc="$blue5" pt="$2">
                <Text fontSize="$3" fontWeight="bold" color="$blue11">
                  Potential Tasks Identified:
                </Text>
                {highLevelNotes.potentialTodos.map((todo, i) => (
                  <Text key={i} fontSize="$2" color="$blue10">
                    • {todo}
                  </Text>
                ))}
              </YStack>
            </YStack>
          )}

          <ScrollView f={1}>
            {result ? (
              <YStack gap="$4">
                <XStack jc="space-between" ai="center">
                  <Text fontWeight="bold" fontSize="$5">
                    Results
                  </Text>
                  {!isSubmitted ? (
                    <Button
                      size="$3"
                      theme="green"
                      onPress={handleSubmitToNotion}
                      disabled={phase === 'submitting'}
                      icon={phase === 'submitting' ? <Spinner /> : undefined}
                    >
                      {phase === 'submitting' ? 'Submitting...' : 'Submit to Notion'}
                    </Button>
                  ) : (
                    <XStack gap="$2" ai="center" bg="$green5" px="$3" py="$1" br="$4">
                      <Text color="$green11" fontWeight="bold">
                        Submitted ✓
                      </Text>
                    </XStack>
                  )}
                </XStack>

                <YStack gap="$2">
                  <Text fontWeight="bold" fontSize="$4" color="$color.gray11">
                    Daily Note
                  </Text>
                  <Markdown content={result.dailyNoteRichMarkdown} />
                </YStack>

                <YStack gap="$3">
                  <Text fontWeight="bold" fontSize="$4" color="$color.gray11">
                    Todos
                  </Text>
                  {result.todos.map((todo) => (
                    <TodoCard key={todo.id} todo={todo} isMatching={phase === 'matching'} />
                  ))}
                </YStack>
              </YStack>
            ) : (
              <Text color="$color.gray10">Processed results will appear here</Text>
            )}
          </ScrollView>
        </YStack>
      </XStack>

      {/* Notion Status Bar */}
      <XStack
        bg="$backgroundHover"
        p="$2"
        px="$4"
        br="$4"
        gap="$4"
        ai="center"
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        {isFetchingContext ? (
          <XStack gap="$2" ai="center">
            <Spinner size="small" />
            <Text fontSize="$2">Fetching Notion context...</Text>
          </XStack>
        ) : context?.stats ? (
          <XStack gap="$4" f={1} ai="center">
            <XStack gap="$2">
              <Text fontSize="$2" fontWeight="bold">
                Notion:
              </Text>
              <Text fontSize="$2">
                {context.stats.total} Total | {context.stats.todo} TODO | {context.stats.inProgress}{' '}
                In Progress | {context.stats.done} Done
              </Text>
            </XStack>

            <Text color="$borderColor">|</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} f={1}>
              <XStack gap="$2">
                <Text fontSize="$2" fontWeight="bold">
                  Projects:
                </Text>
                {context.projects.map((p) => (
                  <XStack
                    key={p}
                    bg="$blue5"
                    px="$2"
                    py="$0.5"
                    br="$2"
                    borderWidth={1}
                    borderColor="$blue8"
                  >
                    <Text fontSize="$1" color="$blue11">
                      {p}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            </ScrollView>
          </XStack>
        ) : (
          <Text fontSize="$2" color="$color.gray10">
            {notionConnected ? 'Notion context not yet loaded' : 'Connect Notion to see stats'}
          </Text>
        )}
      </XStack>
    </YStack>
  );
}

export default App;
