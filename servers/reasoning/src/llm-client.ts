/**
 * LLM Client Adapter
 *
 * Wraps existing Llama inference logic and adds new refinement stages for
 * post-match augmentation and body updates.
 */

import { getLlama, LlamaChatSession, LlamaJsonSchemaGrammar } from 'node-llama-cpp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HighLevelNotes,
  HighLevelNotesSchema,
  DailyNoteResponse,
  DailyNoteSchema,
  NotionContextResponse,
  Todo,
  TodoSchema,
} from '@flwst/types/src/api/reasoning';
import { ILLMClient } from './orchestrator.js';
import { blacklistConfig } from '../../../config/blacklist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the model - assuming it's in the root models directory
// src is at servers/reasoning/src, so we need to go up 3 levels to reach workspace root
const REPO_ROOT = path.resolve(__dirname, '../../../');
const MODEL_PATH =
  process.env.LLAMA_MODEL_PATH ||
  path.resolve(REPO_ROOT, 'models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf');

let llama: any;
let model: any;
let context: any;

/**
 * Initialize Llama model (lazy, singleton)
 */
async function initializeLlama() {
  if (model) return;

  try {
    llama = await getLlama();
    model = await llama.loadModel({
      modelPath: MODEL_PATH,
    });
    context = await model.createContext();
    console.log('[llm-client] Llama model initialized successfully');
  } catch (error) {
    console.error('[llm-client] Failed to initialize Llama model:', error);
    throw error;
  }
}

/**
 * Potential tasks schema for JSON grammar (atomic extraction)
 */
const PotentialTasksSchemaInternal = {
  type: 'array',
  description: 'List of every actionable task extracted from the transcript.',
  items: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The task description' },
      context: {
        type: 'string',
        description: 'The markdown header or topic this task belongs to',
      },
    },
    required: ['text', 'context'],
  },
};

/**
 * LlamaLLMClient
 *
 * Implements ILLMClient using node-llama-cpp for all LLM operations.
 */
export class LlamaLLMClient implements ILLMClient {
  /**
   * Helper to extract JSON from model response
   */
  private extractJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch (e) {
      // Find the first { or [ and the last } or ]
      const firstBrace = text.indexOf('{');
      const firstBracket = text.indexOf('[');
      let start = -1;
      let end = -1;

      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        end = text.lastIndexOf('}');
      } else if (firstBracket !== -1) {
        start = firstBracket;
        end = text.lastIndexOf(']');
      }

      if (start !== -1 && end !== -1 && end > start) {
        let candidate = text.substring(start, end + 1);
        try {
          return JSON.parse(candidate);
        } catch (innerError) {
          // Structural repair: count open vs closed brackets/braces and close them
          console.warn('[llm-client] Attempting structural repair of truncated JSON...');

          const openBraces = (candidate.match(/\{/g) || []).length;
          const closeBraces = (candidate.match(/\}/g) || []).length;
          const openBrackets = (candidate.match(/\[/g) || []).length;
          const closeBrackets = (candidate.match(/\]/g) || []).length;

          // Close arrays first (inner structures), then objects (outer structure)
          if (openBrackets > closeBrackets) {
            candidate += ']'.repeat(openBrackets - closeBrackets);
          }
          if (openBraces > closeBraces) {
            candidate += '}'.repeat(openBraces - closeBraces);
          }

          try {
            return JSON.parse(candidate);
          } catch (repairError) {
            // If structural repair failed, try string repair for unterminated strings
            if (
              innerError instanceof SyntaxError &&
              innerError.message.includes('Unterminated string')
            ) {
              console.warn('[llm-client] Attempting to repair unterminated string...');
              const stringRepaired = candidate.trim() + '" }';
              try {
                return JSON.parse(stringRepaired);
              } catch (finalError) {
                console.error('[llm-client] All JSON repair attempts failed');
                throw innerError;
              }
            }
            console.error('[llm-client] Structural repair failed');
            throw innerError;
          }
        }
      }
      throw e;
    }
  }

  /**
   * Step 1a: Extract potential tasks from transcript (atomic, JSON-only)
   */
  async extractPotentialTasks(
    transcript: string,
    notionContext?: NotionContextResponse,
  ): Promise<Array<{ text: string; context: string }>> {
    await initializeLlama();
    const freshContext = await model.createContext();
    const session = new LlamaChatSession({
      contextSequence: freshContext.getSequence(),
    });

    const grammar = new LlamaJsonSchemaGrammar(llama, PotentialTasksSchemaInternal as any);

    const projectsList =
      notionContext?.projects && notionContext.projects.length > 0
        ? `\nKnown Notion Projects:\n- ${notionContext.projects.join('\n- ')}\n`
        : '';

    const blacklistInstructions =
      blacklistConfig.categories.length > 0
        ? `\nIMPORTANT: Do NOT extract tasks related to:\n${blacklistConfig.categories.map((cat) => `- ${cat}`).join('\n')}\n`
        : '';

    const prompt = `You are a professional task extraction assistant. Extract ONLY actionable tasks from the transcript.

RULES:
1. List EVERY actionable task mentioned in the transcript.
2. CRITICAL: Provide detailed, descriptive text for each task. Do NOT just use the project name.
3. CRITICAL: Do not combine different tasks. If the transcript mentions "task A" and "task B", create TWO separate items.
4. For each task, set "context" to the name of the section header it was found under (e.g., "Flow State Overhaul").
${blacklistInstructions}
${projectsList}

TRANSCRIPT:
"""
${transcript}
"""

Respond with ONLY a JSON array. No markdown code blocks, no preamble, no explanation.
Example:
[{"text": "Go to Whole Foods to buy turkey", "context": "Personal"}, {"text": "Debug ML kit object identification", "context": "Smart Take"}]`;

    try {
      console.log('[llm-client] Step 1a: Extracting potential tasks...');
      let response;
      try {
        response = await session.prompt(prompt, {
          grammar,
          maxTokens: 2048, // Smaller limit since we only need the array
          temperature: 0.1,
        });
      } catch (grammarError) {
        console.warn(
          '[llm-client] Step 1a grammar-constrained prompt failed, retrying without grammar...',
        );
        response = await session.prompt(prompt, {
          maxTokens: 2048,
          temperature: 0.1,
        });
      }

      console.log('[llm-client] Step 1a RAW response length:', response.length);

      let parsed;
      try {
        parsed = this.extractJson(response);
      } catch (parseError) {
        console.error('[llm-client] Step 1a JSON extraction failed');
        console.log('[llm-client] RAW response snippet:', response.substring(0, 500));
        throw parseError;
      }

      // Handle both direct array and wrapped in object
      const tasks = Array.isArray(parsed) ? parsed : parsed.potentialTodos || [];
      console.log('[llm-client] Step 1a extracted tasks count:', tasks.length);
      return tasks;
    } catch (error) {
      console.error('[llm-client] Task extraction failed:', error);
      throw error;
    } finally {
      await freshContext.dispose();
    }
  }

  /**
   * Step 1b: Generate daily note markdown summary (plain text, no JSON)
   */
  async generateDailyNoteMarkdown(
    transcript: string,
    extractedTasks: Array<{ text: string; context: string }>,
    notionContext?: NotionContextResponse,
  ): Promise<string> {
    await initializeLlama();
    const freshContext = await model.createContext();
    const session = new LlamaChatSession({
      contextSequence: freshContext.getSequence(),
    });

    const projectsList =
      notionContext?.projects && notionContext.projects.length > 0
        ? `\nKnown Notion Projects:\n- ${notionContext.projects.join('\n- ')}\n`
        : '';

    const tasksSummary =
      extractedTasks.length > 0
        ? `\nExtracted Tasks:\n${extractedTasks.map((t, i) => `${i + 1}. ${t.text} (${t.context})`).join('\n')}\n`
        : '';

    const prompt = `You are a professional assistant creating a concise daily note summary.

Write a narrative summary of the session in rich markdown format. Use headers (## Topic Name), bold text, and lists. Keep it under 500 words.

${projectsList}
${tasksSummary}

TRANSCRIPT:
"""
${transcript}
"""

Respond with ONLY the markdown content. No JSON wrapper, no code blocks, no preamble.`;

    try {
      console.log('[llm-client] Step 1b: Generating daily note markdown...');
      const response = await session.prompt(prompt, {
        maxTokens: 1024, // Smaller limit for summary
        temperature: 0.2,
      });

      // Clean up any markdown code blocks if the model added them
      let cleaned = response.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:markdown)?\n?/, '').replace(/\n?```$/, '');
      }

      console.log('[llm-client] Step 1b generated markdown length:', cleaned.length);
      return cleaned;
    } catch (error) {
      console.error('[llm-client] Daily note generation failed:', error);
      // Return a fallback summary if generation fails
      return `## Summary\n\nProcessed transcript with ${extractedTasks.length} tasks identified.`;
    } finally {
      await freshContext.dispose();
    }
  }

  /**
   * Step 1: Extract high-level notes from transcript (combines 1a and 1b)
   * This method maintains backward compatibility with the orchestrator interface.
   */
  async extractHighLevelNotes(
    transcript: string,
    notionContext?: NotionContextResponse,
  ): Promise<HighLevelNotes> {
    // Step 1a: Extract tasks (atomic, reliable)
    const potentialTodos = await this.extractPotentialTasks(transcript, notionContext);

    // Step 1b: Generate summary (can fail gracefully)
    const dailyNoteRichMarkdown = await this.generateDailyNoteMarkdown(
      transcript,
      potentialTodos,
      notionContext,
    );

    return {
      potentialTodos,
      dailyNoteRichMarkdown,
    };
  }

  /**
   * Step 2: Generate detailed structured todos
   */
  async generateDetailedStructuredData(
    transcript: string,
    highLevelNotes: HighLevelNotes,
    notionContext?: NotionContextResponse,
  ): Promise<DailyNoteResponse> {
    await initializeLlama();
    const freshContext = await model.createContext();
    const session = new LlamaChatSession({
      contextSequence: freshContext.getSequence(),
    });

    const allowedProjects = notionContext?.projects?.slice(0, 50) ?? [];
    const projectsContext =
      allowedProjects.length > 0
        ? `\nVALID NOTION PROJECTS (MANDATORY: Use these exact strings for the "project" field):\n- ${allowedProjects.join('\n- ')}\n`
        : '';

    const prompt = `You are an expert Task Extraction Agent. Convert the following extracted tasks into a structured JSON array of "todos".

TASKS TO CONVERT:
${highLevelNotes.potentialTodos.map((t, i) => `${i + 1}. "${t.text}" (Context: ${t.context})`).join('\n')}

${projectsContext}

JSON SCHEMA:
{
  "todos": [
    {
      "id": "string",
      "text": "string",
      "completed": boolean,
      "project": "string",
      "status": "string",
      "priority": "string",
      "dueDate": "YYYY-MM-DD"
    }
  ]
}
RULES:
1. Extract EVERY task listed above into the "todos" array.
2. DO NOT DUPLICATE TASKS.
3. Use the EXACT text provided in TASKS TO CONVERT for the "text" field.
4. Assign each task a unique "id".
5. Match the "project" field to VALID NOTION PROJECTS.
6. Set "completed" to false.
7. DO NOT RETURN NULL OR EMPTY STRINGS: Omit any fields that are unknown. Do not set fields to "" or null.

Respond with ONLY the JSON object.`;

    try {
      console.log('[llm-client] Step 2 prompt length:', prompt.length);

      const response = await session.prompt(prompt, {
        maxTokens: 2048,
        temperature: 0.1,
        repeatPenalty: { penalty: 1.1 },
      });

      console.log('[llm-client] Step 2 RAW response length:', response.length);

      let parsed;
      try {
        parsed = this.extractJson(response);
      } catch (e) {
        console.warn('[llm-client] Step 2 JSON extraction failed');
        throw e;
      }

      // Handle both { "todos": [...] } and direct [...] array, and clean up nulls and empty strings
      const rawTodos = Array.isArray(parsed) ? parsed : parsed.todos || [];
      const extractedTodos = rawTodos.map((todo: any) => {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(todo)) {
          // Remove null, undefined, AND empty strings for optional enum/date fields
          if (value !== null && value !== undefined && value !== '') {
            cleaned[key] = value;
          }
        }
        return cleaned;
      });

      const todosWithStatus = applyContextStatusHints(extractedTodos, highLevelNotes);

      console.log('[llm-client] Step 2 extracted todos count:', extractedTodos.length);

      const result = {
        dailyNoteRichMarkdown: highLevelNotes.dailyNoteRichMarkdown,
        todos: todosWithStatus,
      };

      const validated = DailyNoteSchema.parse(result);
      console.log('[llm-client] Step 2 validated todos count:', validated.todos.length);
      return validated;
    } catch (error) {
      console.error('[llm-client] Step 2 generation failed:', error);
      return {
        dailyNoteRichMarkdown: highLevelNotes.dailyNoteRichMarkdown,
        todos: [],
      };
    } finally {
      await freshContext.dispose();
    }
  }

  /**
   * Stage A: Update matched Notion task body with new transcript info
   */
  async updateMatchedTodoBody(
    todo: Todo,
    existingBody: string,
    transcript: string,
    dailyNoteMarkdown: string,
  ): Promise<string> {
    await initializeLlama();
    const freshContext = await model.createContext();
    const session = new LlamaChatSession({
      contextSequence: freshContext.getSequence(),
    });

    const prompt = `You are updating a Notion task page body with new information from a transcript.

TASK: ${todo.text}
PROJECT: ${todo.project || 'N/A'}

EXISTING TASK BODY:
"""
${existingBody || '(empty)'}
"""

NEW TRANSCRIPT CONTEXT:
"""
${transcript}
"""

DAILY NOTE SUMMARY:
"""
${dailyNoteMarkdown}
"""

INSTRUCTIONS:
1. Preserve useful existing content from the task body
2. Incorporate relevant new information from the transcript and daily note
3. Add missing details, next steps, or acceptance criteria if mentioned
4. Do NOT rename the task (keep the title unchanged)
5. Output clean, well-formatted markdown
6. If the existing body is empty or minimal, create a comprehensive description

Respond with ONLY the updated markdown body (no JSON wrapper, no explanations).`;

    try {
      const response = await session.prompt(prompt, {
        maxTokens: 1024,
        temperature: 0.3,
      });

      let cleaned = response.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:markdown)?\n?/, '').replace(/\n?```$/, '');
      }

      return cleaned;
    } catch (error) {
      console.error('[llm-client] Failed to update matched todo body:', error);
      return `${existingBody}\n\n---\n\n*Note: Failed to merge new transcript context automatically.*`;
    } finally {
      await freshContext.dispose();
    }
  }

  /**
   * Stage B: Refine unmatched todo with project neighborhood context
   */
  async refineTodoWithProjectContext(
    todo: Todo,
    projectNeighborhood: {
      existingTasks: Array<{ title: string; body?: string }>;
      otherTodosInRun: Todo[];
    },
    transcript: string,
    dailyNoteMarkdown: string,
  ): Promise<Todo> {
    await initializeLlama();
    const freshContext = await model.createContext();
    const session = new LlamaChatSession({
      contextSequence: freshContext.getSequence(),
    });

    const existingTasksList =
      projectNeighborhood.existingTasks.length > 0
        ? projectNeighborhood.existingTasks.map((t) => `- ${t.title}`).join('\n')
        : '(none found)';

    const otherTodosList =
      projectNeighborhood.otherTodosInRun.length > 0
        ? projectNeighborhood.otherTodosInRun.map((t) => `- ${t.text}`).join('\n')
        : '(none)';

    const prompt = `You are refining a new todo task by adding project context and dependencies.

ORIGINAL TODO:
- Text: "${todo.text}"
- Project: ${todo.project || 'Personal'}
- Description: ${todo.description || '(none)'}

EXISTING TASKS IN SAME PROJECT:
${existingTasksList}

OTHER TODOS FROM THIS TRANSCRIPT IN SAME PROJECT:
${otherTodosList}

TRANSCRIPT CONTEXT (EXCERPT):
"""
${transcript.substring(0, 2000)}...
"""

DAILY NOTE SUMMARY (EXCERPT):
"""
${dailyNoteMarkdown.substring(0, 1000)}...
"""

INSTRUCTIONS:
1. Keep the todo text actionable and specific
2. Enhance the description with dependencies or linkage to existing work
3. Only add priority/dueDate/tags if STRONGLY implied by the transcript
4. DO NOT RETURN NULL: Omit any fields that are unknown.

Respond with a JSON object.`;

    try {
      const response = await session.prompt(prompt, {
        maxTokens: 1024,
        temperature: 0.2,
      });

      let parsed;
      try {
        parsed = this.extractJson(response);
      } catch (e) {
        throw e;
      }

      // Merge and clean nulls
      const cleaned: any = { ...todo };
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== null && value !== undefined) {
          cleaned[key] = value;
        }
      }

      return TodoSchema.parse(cleaned);
    } catch (error) {
      console.error('[llm-client] Failed to refine todo:', error);
      return todo;
    } finally {
      await freshContext.dispose();
    }
  }
}

type ExtractedTodo = {
  text?: string;
  status?: string;
} & Record<string, unknown>;

// Apply status inference from high-level context when LLM omits status.
export function applyContextStatusHints(
  todos: ExtractedTodo[],
  highLevelNotes: HighLevelNotes,
): ExtractedTodo[] {
  const contextByText = new Map<string, string>();
  for (const item of highLevelNotes.potentialTodos) {
    const normalizedText = normalizeTodoText(item.text);
    if (!normalizedText) continue;
    contextByText.set(normalizedText, item.context ?? '');
    const strippedText = stripStatusSuffix(normalizedText);
    if (strippedText && strippedText !== normalizedText) {
      contextByText.set(strippedText, item.context ?? '');
    }
  }

  return todos.map((todo) => {
    const textKey = normalizeTodoText(todo.text ?? '');
    if (!textKey) return todo;
    const context = contextByText.get(textKey) ?? contextByText.get(stripStatusSuffix(textKey));
    const inferredStatus = context ? inferStatusFromContext(context) : undefined;
    if (!inferredStatus) return todo;
    const currentStatus = normalizeStatusForCompare(todo.status);
    if (currentStatus === inferredStatus) return todo;
    return { ...todo, status: inferredStatus };
  });
}

// Infer status from section headers like "Done" or "In Progress".
export function inferStatusFromContext(context: string): Todo['status'] | undefined {
  const normalized = context.toLowerCase();

  if (matchesAny(normalized, ['cancelled', 'canceled', "won't do", 'wont do', 'dropped'])) {
    return 'Cancelled';
  }
  if (matchesAny(normalized, ['blocked', 'stuck', 'waiting', 'paused'])) {
    return 'BLOCKED';
  }
  if (matchesAny(normalized, ['done', 'complete', 'completed', 'finished', 'shipped'])) {
    return 'Done';
  }
  if (matchesAny(normalized, ['in progress', 'in-progress', 'doing', 'working on'])) {
    return 'In Progress';
  }
  if (matchesAny(normalized, ['on deck', 'next up', 'next'])) {
    return 'On Deck';
  }
  if (matchesAny(normalized, ['todo', 'to-do', 'to do', 'backlog'])) {
    return 'TODO';
  }

  return undefined;
}

function matchesAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

function normalizeTodoText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').trim().replace(/\s+/g, ' ');
}

function stripStatusSuffix(text: string): string {
  const suffixes = [
    ' done',
    ' completed',
    ' complete',
    ' finished',
    ' shipped',
    ' in progress',
    ' in-progress',
    ' on deck',
    ' todo',
    ' blocked',
    ' cancelled',
    ' canceled',
    " won't do",
    ' wont do',
  ];
  for (const suffix of suffixes) {
    if (text.endsWith(suffix)) {
      return text.slice(0, -suffix.length).trim();
    }
  }
  return text;
}

function normalizeStatusForCompare(status?: string): Todo['status'] | undefined {
  if (!status) return undefined;
  const normalized = status.trim().toLowerCase();
  const mapping: Record<string, Todo['status']> = {
    todo: 'TODO',
    'on deck': 'On Deck',
    'in progress': 'In Progress',
    blocked: 'BLOCKED',
    done: 'Done',
    cancelled: 'Cancelled',
  };
  return mapping[normalized];
}
