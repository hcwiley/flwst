import { z } from 'zod';

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
  notionContext: NotionContextResponseSchema.optional(),
  highLevelNotes: HighLevelNotesSchema.optional(),
});

/**
 * Response schema for Phase 1: LLM-only results (no Notion matching)
 */
export const ProcessTranscriptResponseSchema = DailyNoteSchema;

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

export type ProcessTranscriptRequest = z.infer<typeof ProcessTranscriptRequestSchema>;
export type ProcessTranscriptResponse = z.infer<typeof ProcessTranscriptResponseSchema>;
export type NotionMatchRequest = z.infer<typeof NotionMatchRequestSchema>;
export type NotionMatchResponse = z.infer<typeof NotionMatchResponseSchema>;
