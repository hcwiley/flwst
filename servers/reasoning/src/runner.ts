/**
 * Stateless reasoning runner.
 *
 * Accepts a single request payload, runs the reasoning pipeline, and
 * returns draft objects without persisting session state or writing to Notion.
 */
import { randomUUID } from 'node:crypto';
import {
  DailyNoteDraftSchema,
  MatchSuggestionSchema,
  ProcessTranscriptRequest,
  ProcessTranscriptRequestSchema,
  ProcessTranscriptResponse,
  ProcessTranscriptResponseSchema,
  TodoDraftSchema,
} from '@flwst/types/src/api/reasoning';
import { LlamaLLMClient } from './llm-client.js';
import { MCPNotionClient } from './notion-client.js';
import {
  ReasoningOrchestrator,
  ReasoningState,
  type ILLMClient,
  type INotionClient,
} from './orchestrator.js';

type RunnerDeps = {
  llmClient: ILLMClient;
  notionClient: INotionClient;
};

const DEFAULT_DEPS: RunnerDeps = {
  llmClient: new LlamaLLMClient(),
  notionClient: new MCPNotionClient(),
};

export async function runReasoningPipeline(
  request: ProcessTranscriptRequest,
  deps: Partial<RunnerDeps> = {},
): Promise<ProcessTranscriptResponse> {
  const parsed = ProcessTranscriptRequestSchema.parse(request);
  const { sessionId, transcript, context } = parsed;
  const llmClient = deps.llmClient ?? DEFAULT_DEPS.llmClient;
  const notionClient = deps.notionClient ?? DEFAULT_DEPS.notionClient;

  const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript, context);
  const result = await orchestrator.run(ReasoningState.TODOS_MATCHED);

  const dailyNoteLocalId = buildDailyNoteLocalId(sessionId);
  const dailyNoteDraft = DailyNoteDraftSchema.parse({
    localId: dailyNoteLocalId,
    sessionId,
    dailyNoteRichMarkdown: result.dailyNoteRichMarkdown,
  });

  const todoDrafts = result.todos.map((todo) => {
    const localId = todo.id?.trim() ? todo.id : randomUUID();
    return TodoDraftSchema.parse({
      ...todo,
      id: localId,
      localId,
      sessionId,
      matchState: todo.isMatched ? 'matched' : 'new',
      notionTargetId: todo.notionId,
    });
  });

  const matchSuggestions = todoDrafts.map((draft) =>
    MatchSuggestionSchema.parse({
      localId: draft.localId,
      matchState: draft.matchState,
      notionTargetId: draft.notionTargetId,
      confidence: draft.matchState === 'matched' ? 0.9 : 0.2,
      reason: draft.matchState === 'matched' ? 'Matched via Notion search' : 'No match found',
    }),
  );

  return ProcessTranscriptResponseSchema.parse({
    dailyNoteDraft,
    todoDrafts,
    matchSuggestions,
  });
}

function buildDailyNoteLocalId(sessionId: string): string {
  return `daily-${sessionId}`;
}
