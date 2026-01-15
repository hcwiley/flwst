import { z } from 'zod';

/**
 * Shared Zod schemas for reasoning, Notion, and IPC contracts.
 *
 * These schemas are the single source of truth for data shapes across
 * renderer, Electron main, and the reasoning utility. Extend here first
 * and validate at every boundary to keep the system type-safe.
 */

export const TodoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
  source: z.string().optional(), // Where this todo came from in the transcript
  // Notion properties
  priority: z.enum(['TOP', 'High', 'Medium', 'Low', 'Back burner']).optional(),
  status: z.enum(['TODO', 'On Deck', 'In Progress', 'BLOCKED', 'Done', 'Cancelled']).optional(),
  project: z.string().optional(),
  description: z.string().optional(), // Full markdown description, separate from text
  dueDate: z.string().optional(), // ISO date string
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(), // Person reference
  notionId: z.string().optional(), // Notion page ID if matched
  notionUrl: z.string().optional(), // Notion page URL if matched
  isMatched: z.boolean().default(false), // Whether this todo matched an existing Notion task
});

export const DailyNoteSchema = z.object({
  dailyNoteRichMarkdown: z.string(),
  todos: z.array(TodoSchema),
  discoveredTodos: z.array(TodoSchema).optional(),
});

export type Todo = z.infer<typeof TodoSchema>;
export type DailyNoteResponse = z.infer<typeof DailyNoteSchema>;

/**
 * Lightweight Notion “context” returned to the client to help the LLM classify
 * todos (especially `project`) before matching.
 */
export const NotionContextExampleSchema = z.object({
  project: z.string(),
  titles: z.array(z.string()),
});

export const NotionContextResponseSchema = z.object({
  seed: z.string(),
  sampledCount: z.number().int(),
  projects: z.array(z.string()),
  examples: z.array(NotionContextExampleSchema),
  stats: z
    .object({
      total: z.number(),
      todo: z.number(),
      inProgress: z.number(),
      done: z.number(),
    })
    .optional(),
});

export type NotionContextExample = z.infer<typeof NotionContextExampleSchema>;
export type NotionContextResponse = z.infer<typeof NotionContextResponseSchema>;

/**
 * Draft-specific fields for session-managed todos and daily notes.
 */
export const MatchStateSchema = z.enum(['new', 'matched', 'ambiguous', 'ignored']);
export const SubmitStateSchema = z.enum(['idle', 'pending', 'success', 'error']);

export const TodoDraftSchema = TodoSchema.extend({
  localId: z.string(),
  sessionId: z.string(),
  matchState: MatchStateSchema,
  notionTargetId: z.string().optional(),
  includeInSubmit: z.boolean().default(true),
  submitState: SubmitStateSchema.default('idle'),
  error: z.string().optional(),
});

export const DailyNoteDraftSchema = z.object({
  localId: z.string(),
  sessionId: z.string(),
  dailyNoteRichMarkdown: z.string(),
  includeInSubmit: z.boolean().default(true),
  submitState: SubmitStateSchema.default('idle'),
  error: z.string().optional(),
});

export const MatchSuggestionSchema = z.object({
  localId: z.string(),
  matchState: MatchStateSchema,
  notionTargetId: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});

export type MatchState = z.infer<typeof MatchStateSchema>;
export type SubmitState = z.infer<typeof SubmitStateSchema>;
export type TodoDraft = z.infer<typeof TodoDraftSchema>;
export type DailyNoteDraft = z.infer<typeof DailyNoteDraftSchema>;
export type MatchSuggestion = z.infer<typeof MatchSuggestionSchema>;

/**
 * High-level notes schema
 */
export const HighLevelNotesSchema = z.object({
  dailyNoteRichMarkdown: z.string(),
  potentialTodos: z.array(
    z.object({
      text: z.string(),
      context: z.string(), // The header or topic this task was found under
    }),
  ),
});

export type HighLevelNotes = z.infer<typeof HighLevelNotesSchema>;

/**
 * Request schema for Phase 3: Submit to Notion
 */
export const SubmitToNotionRequestSchema = z.object({
  dailyNoteRichMarkdown: z.string(),
  todos: z.array(TodoSchema),
});

export type SubmitToNotionRequest = z.infer<typeof SubmitToNotionRequestSchema>;

/**
 * Request schema for Phase 1a: Extract high-level notes
 */
export const ProcessHighLevelRequestSchema = z.object({
  transcript: z.string(),
  notionContext: NotionContextResponseSchema.optional(),
});

/**
 * Request schema for Phase 1b: Detailed structured extraction
 */
export const ProcessTranscriptRequestSchema = z.object({
  transcript: z.string(),
  sessionId: z.string(),
  context: NotionContextResponseSchema.optional(),
});

/**
 * Response schema for Phase 1: LLM-only results (no Notion matching)
 */
export const ProcessTranscriptResponseSchema = z.object({
  dailyNoteDraft: DailyNoteDraftSchema,
  todoDrafts: z.array(TodoDraftSchema),
  matchSuggestions: z.array(MatchSuggestionSchema).optional(),
});

/**
 * Async processing job schemas for HTTP polling.
 */
export const ProcessTranscriptJobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
]);

export const ProcessTranscriptJobPhaseSchema = z.enum([
  'fetching',
  'analyzing',
  'reasoning',
  'matching',
  'done',
  'error',
]);

export const ProcessTranscriptJobStartResponseSchema = z.object({
  jobId: z.string(),
  status: ProcessTranscriptJobStatusSchema,
});

export const ProcessTranscriptJobResponseSchema = z.object({
  jobId: z.string(),
  status: ProcessTranscriptJobStatusSchema,
  phase: ProcessTranscriptJobPhaseSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  result: ProcessTranscriptResponseSchema.optional(),
  error: z.string().optional(),
});

/**
 * Request schema for Phase 2: Match todos with Notion tasks
 */
export const NotionMatchRequestSchema = z.object({
  todos: z.array(TodoSchema),
});

/**
 * Response schema for Phase 2: Enriched todos with Notion data
 */
export const NotionMatchResponseSchema = z.object({
  todos: z.array(TodoSchema),
  warning: z.string().optional(), // Optional warning if matching partially failed
});

/**
 * IPC contracts for Electron renderer <-> main.
 */
export const NotionSelectOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z.string().optional(),
});

export const NotionTodoCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  project: z.string().optional(),
  status: z.string().optional(),
  dueDate: z.string().optional(),
  lastEditedTime: z.string().optional(),
  notionUrl: z.string().optional(),
});

export const BootstrapMirrorRequestSchema = z.object({}).strict();

export const BootstrapMirrorResponseSchema = z.object({
  projects: z.array(NotionSelectOptionSchema),
  statuses: z.array(NotionSelectOptionSchema),
  kanbanItems: z.array(NotionTodoCardSchema),
  lastSyncTime: z.string().optional(),
});

export const KanbanFilterSchema = z.object({
  project: z.string().optional(),
  status: z.string().optional(),
  dueDateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
  lastModifiedAfter: z.string().optional(),
  createdAfter: z.string().optional(),
});

export const RefreshKanbanRequestSchema = z.object({
  filters: KanbanFilterSchema.optional(),
});

export const RefreshKanbanResponseSchema = z.object({
  kanbanItems: z.array(NotionTodoCardSchema),
  lastSyncTime: z.string().optional(),
});

export const SubmitResultSchema = z.object({
  localId: z.string(),
  status: z.enum(['success', 'error']),
  notionPageId: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const SubmitSessionRequestSchema = z.object({
  dailyNoteDraft: DailyNoteDraftSchema,
  todoDrafts: z.array(TodoDraftSchema),
});

export const SubmitSessionResponseSchema = z.object({
  dailyNoteResult: SubmitResultSchema,
  todoResults: z.array(SubmitResultSchema),
});

export const SubmitOneRequestSchema = z.object({
  draft: TodoDraftSchema,
});

export const SubmitOneResponseSchema = z.object({
  result: SubmitResultSchema,
});

export const NotionStatusRequestSchema = z.object({}).strict();
export const NotionStatusResponseSchema = z.object({
  connected: z.boolean(),
  error: z.string().optional(),
});

export const NotionConnectRequestSchema = z.object({}).strict();
export const NotionConnectResponseSchema = z.object({
  connected: z.boolean(),
  error: z.string().optional(),
});

export type ProcessTranscriptRequest = z.infer<typeof ProcessTranscriptRequestSchema>;
export type ProcessTranscriptResponse = z.infer<typeof ProcessTranscriptResponseSchema>;
export type ProcessTranscriptJobStatus = z.infer<typeof ProcessTranscriptJobStatusSchema>;
export type ProcessTranscriptJobPhase = z.infer<typeof ProcessTranscriptJobPhaseSchema>;
export type ProcessTranscriptJobStartResponse = z.infer<
  typeof ProcessTranscriptJobStartResponseSchema
>;
export type ProcessTranscriptJobResponse = z.infer<typeof ProcessTranscriptJobResponseSchema>;
export type NotionMatchRequest = z.infer<typeof NotionMatchRequestSchema>;
export type NotionMatchResponse = z.infer<typeof NotionMatchResponseSchema>;
export type NotionSelectOption = z.infer<typeof NotionSelectOptionSchema>;
export type NotionTodoCard = z.infer<typeof NotionTodoCardSchema>;
export type BootstrapMirrorRequest = z.infer<typeof BootstrapMirrorRequestSchema>;
export type BootstrapMirrorResponse = z.infer<typeof BootstrapMirrorResponseSchema>;
export type RefreshKanbanRequest = z.infer<typeof RefreshKanbanRequestSchema>;
export type RefreshKanbanResponse = z.infer<typeof RefreshKanbanResponseSchema>;
export type SubmitResult = z.infer<typeof SubmitResultSchema>;
export type SubmitSessionRequest = z.infer<typeof SubmitSessionRequestSchema>;
export type SubmitSessionResponse = z.infer<typeof SubmitSessionResponseSchema>;
export type SubmitOneRequest = z.infer<typeof SubmitOneRequestSchema>;
export type SubmitOneResponse = z.infer<typeof SubmitOneResponseSchema>;
export type NotionStatusRequest = z.infer<typeof NotionStatusRequestSchema>;
export type NotionStatusResponse = z.infer<typeof NotionStatusResponseSchema>;
export type NotionConnectRequest = z.infer<typeof NotionConnectRequestSchema>;
export type NotionConnectResponse = z.infer<typeof NotionConnectResponseSchema>;
