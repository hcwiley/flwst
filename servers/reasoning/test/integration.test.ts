import { describe, it, expect } from 'vitest';
import { LlamaLLMClient } from '../src/llm-client.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only run this if we're explicitly running integration tests
const isIntegration = process.env.TEST_TYPE === 'integration';

describe.skipIf(!isIntegration)('Integration Tests', () => {
  it('should process the sample transcript with the real model', async () => {
    const transcriptPath = path.resolve(__dirname, '../../../data/test/transcript.txt');
    const transcript = await fs.readFile(transcriptPath, 'utf-8');

    console.log('Processing transcript length:', transcript.length);

    const llmClient = new LlamaLLMClient();
    const result = await llmClient.extractHighLevelNotes(transcript);
    const detailed = await llmClient.generateDetailedStructuredData(transcript, result);

    console.log('Result:', JSON.stringify(detailed, null, 2));

    expect(detailed).toHaveProperty('dailyNoteRichMarkdown');
    expect(detailed).toHaveProperty('todos');
    expect(detailed.todos.length).toBeGreaterThan(0);

    // Check for specific content we expect from the transcript
    const note = detailed.dailyNoteRichMarkdown.toLowerCase();
    expect(note).toContain('sherpa');
    expect(note).toContain('flow state');
  }, 120000); // 2 minute timeout
});
