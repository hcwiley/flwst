import { z } from 'zod';

export const TodoSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
  source: z.string().optional(), // Where this todo came from in the transcript
});

export const DailyNoteSchema = z.object({
  dailyNoteRichMarkdown: z.string(),
  todos: z.array(TodoSchema),
  discoveredTodos: z.array(TodoSchema).optional(),
});

export type Todo = z.infer<typeof TodoSchema>;
export type DailyNoteResponse = z.infer<typeof DailyNoteSchema>;
