import { getLlama, LlamaChatSession, LlamaJsonSchemaGrammar } from 'node-llama-cpp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { DailyNoteResponse, DailyNoteSchema } from '@flwst/types/api/reasoning';

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

// ...

export async function processTranscript(transcript: string): Promise<DailyNoteResponse> {
  await initializeLlama();

  // Create a fresh context sequence for each request to avoid "No sequences left" error
  const freshContext = await model.createContext();

  const session = new LlamaChatSession({
    contextSequence: freshContext.getSequence(),
  });

  // Create JSON schema manually to ensure compatibility with node-llama-cpp
  const jsonSchema = {
    type: 'object',
    properties: {
      dailyNoteRichMarkdown: {
        type: 'string',
        description: 'Rich markdown daily note summarizing the content',
      },
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            completed: { type: 'boolean' },
          },
          required: ['id', 'text', 'completed'],
        },
      },
      discoveredTodos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            completed: { type: 'boolean' },
          },
          required: ['id', 'text', 'completed'],
        },
      },
    },
    required: ['dailyNoteRichMarkdown', 'todos'],
  };

  const grammar = new LlamaJsonSchemaGrammar(llama, jsonSchema as any);

  const prompt = `You are an AI assistant that processes daily transcripts into structured data.

Analyze this transcript and extract:
1. A daily note summary in markdown format
2. Explicit todos mentioned
3. Implied todos (optional)

Each todo must have: id (string), text (string), completed (boolean).

Transcript:
${transcript}

Respond with valid JSON matching this exact structure:
{
  "dailyNoteRichMarkdown": "# Summary\\n\\nYour markdown here",
  "todos": [{"id": "1", "text": "Todo text", "completed": false}],
  "discoveredTodos": []
}`;

  console.log('Processing transcript with Llama...');

  try {
    const response = await session.prompt(prompt, {
      grammar,
      maxTokens: 4096,
    });

    console.log('Llama response:', response);

    const parsed = JSON.parse(response);
    return DailyNoteSchema.parse(parsed);
  } catch (error) {
    console.error('Failed to parse Llama response:', error);
    throw new Error('Failed to parse LLM response');
  } finally {
    // Dispose of the context to free up resources
    await freshContext.dispose();
  }
}
