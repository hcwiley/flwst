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
  type DailyNoteResponse,
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

  return buildDraftResponse(sessionId, result);
}

export function buildDraftResponse(
  sessionId: string,
  result: DailyNoteResponse,
): ProcessTranscriptResponse {
  const dailyNoteLocalId = buildDailyNoteLocalId(sessionId);
  const dailyNoteDraft = DailyNoteDraftSchema.parse({
    localId: dailyNoteLocalId,
    sessionId,
    dailyNoteRichMarkdown: result.dailyNoteRichMarkdown,
  });

  const todoDrafts = result.todos.map((todo) => {
    const localId = todo.id?.trim() ? todo.id : randomUUID();
    let normalizedStatus = normalizeTodoStatus(todo.status);

    // Map completed: true to status: 'Done' if status is not already set
    // This ensures that todos marked as completed in the transcript get the correct status
    if (!normalizedStatus && todo.completed === true) {
      normalizedStatus = 'Done';
      console.log(`[runner] Mapped completed=true to status='Done' for "${todo.text}"`);
    }

    const normalizedPriority = normalizeTodoPriority(todo.priority);
    const draft = TodoDraftSchema.parse({
      ...todo,
      id: localId,
      localId,
      sessionId,
      status: normalizedStatus ?? undefined,
      priority: normalizedPriority ?? undefined,
      matchState: todo.isMatched ? 'matched' : 'new',
      notionTargetId: todo.notionId,
    });
    // Log status conversion from Todo to TodoDraft
    console.log(
      `[runner] Draft conversion for "${todo.text}": status=${JSON.stringify(todo.status)} -> ${JSON.stringify(draft.status)}, completed=${JSON.stringify(todo.completed)} -> ${JSON.stringify(draft.completed)}`,
    );
    return draft;
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

function normalizeTodoStatus(status?: string): string | undefined {
  if (!status) return undefined;
  const normalized = status.trim().toLowerCase();
  const mapping: Record<string, string> = {
    todo: 'TODO',
    'on deck': 'On Deck',
    'in progress': 'In Progress',
    blocked: 'BLOCKED',
    done: 'Done',
    cancelled: 'Cancelled',
  };
  return mapping[normalized];
}

function normalizeTodoPriority(priority?: string): string | undefined {
  if (!priority) return undefined;
  const normalized = priority.trim().toLowerCase();
  const mapping: Record<string, string> = {
    top: 'TOP',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    'back burner': 'Back burner',
  };
  return mapping[normalized];
}
