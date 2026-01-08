import { getLlama, LlamaChatSession, LlamaJsonSchemaGrammar } from 'node-llama-cpp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  DailyNoteResponse,
  DailyNoteSchema,
  NotionContextResponse,
  HighLevelNotes,
} from '@flwst/types/api/reasoning';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the model - assuming it's in the root models directory
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const MODEL_PATH =
  process.env.LLAMA_MODEL_PATH ||
  path.resolve(REPO_ROOT, 'models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf');

let llama: any;
let model: any;
let context: any;

async function initializeLlama() {
  if (model) return;

  try {
    llama = await getLlama();
    model = await llama.loadModel({
      modelPath: MODEL_PATH,
    });
    context = await model.createContext();
    console.log('Llama model initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Llama model:', error);
    throw error;
  }
}

/**
 * Step 1: High-level analysis of the transcript.
 */
const HighLevelNotesSchemaInternal = {
  type: 'object',
  properties: {
    dailyNoteRichMarkdown: {
      type: 'string',
      description: 'A detailed narrative summary of the session in rich markdown.',
    },
    potentialTodos: {
      type: 'array',
      description: 'List of every task extracted from the summary, with its section context.',
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
    },
  },
  required: ['dailyNoteRichMarkdown', 'potentialTodos'],
};

/**
 * Process a transcript into a daily note + todos using a two-step approach.
 * Now split into distinct exported functions to allow multiple API calls.
 */
export async function processTranscript(
  transcript: string,
  notionContext?: NotionContextResponse,
  highLevelNotes?: HighLevelNotes,
): Promise<DailyNoteResponse> {
  await initializeLlama();

  let notes = highLevelNotes;
  if (!notes) {
    console.log('[llm/model] Step 1: Extracting high-level notes (auto)...');
    notes = await extractHighLevelNotes(transcript, notionContext);
  }

  // Step 2: Detailed Structured Extraction
  console.log('[llm/model] Step 2: Generating detailed structured data...');
  return await generateDetailedStructuredData(transcript, notes, notionContext);
}

/**
 * Step 1: Extracts high-level summary and potential tasks from the transcript.
 */
export async function extractHighLevelNotes(
  transcript: string,
  notionContext?: NotionContextResponse,
): Promise<HighLevelNotes> {
  await initializeLlama();
  const freshContext = await model.createContext();
  const session = new LlamaChatSession({
    contextSequence: freshContext.getSequence(),
  });

  const grammar = new LlamaJsonSchemaGrammar(llama, HighLevelNotesSchemaInternal as any);

  const projectsList =
    notionContext?.projects && notionContext.projects.length > 0
      ? `\nKnown Notion Projects:\n- ${notionContext.projects.join('\n- ')}\n`
      : '';

  const prompt = `You are a professional assistant summarizing a transcript.
1. Write a detailed "dailyNoteRichMarkdown" summarizing the session. Use headers (## Topic Name), bold text, and lists.
2. List all tasks mentioned in your summary in "potentialTodos".
3. For each task, set "context" to the name of the section header it was found under (e.g., "Flow State Overhaul").

${projectsList}

TRANSCRIPT:
\"\"\"
${transcript}
\"\"\"

Respond with valid JSON.
Example structure:
{
  "dailyNoteRichMarkdown": "## Topic\\n* Task 1",
  "potentialTodos": [{"text": "Task 1", "context": "Topic"}]
}`;

  try {
    const response = await session.prompt(prompt, {
      grammar,
      maxTokens: 2048,
      temperature: 0.5,
    });

    return JSON.parse(response);
  } catch (error) {
    console.error('[llm/model] High-level extraction failed:', error);
    throw error;
  } finally {
    await freshContext.dispose();
  }
}

/**
 * Step 2: Generates the final structured DailyNoteResponse.
 */
async function generateDetailedStructuredData(
  transcript: string,
  highLevelNotes: HighLevelNotes,
  notionContext?: NotionContextResponse,
): Promise<DailyNoteResponse> {
  const freshContext = await model.createContext();
  const session = new LlamaChatSession({
    contextSequence: freshContext.getSequence(),
  });

  // Prefer a small number of projects to keep the grammar manageable.
  const allowedProjects = notionContext?.projects?.slice(0, 50) ?? [];

  const jsonSchema = {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            completed: { type: 'boolean' },
            project: { type: 'string' },
            status: {
              type: 'string',
              enum: ['TODO', 'On Deck', 'In Progress', 'BLOCKED', 'Done', 'Cancelled'],
            },
            priority: {
              type: 'string',
              enum: ['TOP', 'High', 'Medium', 'Low', 'Back burner'],
            },
            dueDate: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            },
          },
          required: ['id', 'text', 'completed'],
        },
      },
    },
    required: ['todos'],
  };

  const grammar = new LlamaJsonSchemaGrammar(llama, jsonSchema as any);

  const projectsContext =
    allowedProjects.length > 0
      ? `\nVALID NOTION PROJECTS:\n- ${allowedProjects.join('\n- ')}\n`
      : '';

  const highLevelContext = `
[SUMMARY FROM STEP 1]
${highLevelNotes.dailyNoteRichMarkdown}

[TASKS TO EXTRACT WITH SECTION CONTEXT]
${highLevelNotes.potentialTodos.map((t) => `- Task: "${t.text}" (Found under section: "${t.context}")`).join('\n')}
`;

  const prompt = `You are a data analyst. Review the summary sections and the original transcript to extract structured TODOs.

${highLevelContext}
${projectsContext}

ORIGINAL TRANSCRIPT:
\"\"\"
${transcript}
\"\"\"

EXTRACTION RULES:
1. For each task in [TASKS TO EXTRACT], use its "context" header to correctly assign the "project".
2. Match the "context" header to the VALID NOTION PROJECTS list (e.g., if context is "Flow State Overhaul", map to "flowState").
3. CRITICAL: Do NOT default everything to one project (like RIOS). Use the section context.
4. If a task is personal (food, home, errands), use "Project": "Personal".
5. Fill the "todos" array with valid JSON objects.

Respond with valid JSON matching the schema.`;

  try {
    const response = await session.prompt(prompt, {
      grammar,
      maxTokens: 2048,
      temperature: 0.1,
      repeatPenalty: { penalty: 1.1 },
    });

    console.log('[llm/model] Step 2 RAW response length:', response.length);
    console.log('[llm/model] Step 2 RAW response:', response);

    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      console.warn('[llm/model] Step 2 JSON parse failed, attempting recovery...');
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw e;
      }
    }

    const extractedTodos = parsed.todos || [];
    console.log(`[llm/model] Step 2 extracted ${extractedTodos.length} todos`);

    return {
      dailyNoteRichMarkdown: highLevelNotes.dailyNoteRichMarkdown,
      todos: extractedTodos,
    };
  } catch (error) {
    console.error('[llm/model] Step 2 generation failed:', error);
    // Fallback: return empty todos but keep the markdown so the user sees SOMETHING
    return {
      dailyNoteRichMarkdown: highLevelNotes.dailyNoteRichMarkdown,
      todos: [],
    };
  } finally {
    await freshContext.dispose();
  }
}
