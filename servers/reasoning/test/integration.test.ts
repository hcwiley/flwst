import { describe, it, expect } from 'vitest';
import { processTranscript } from '../src/llm/model.js';
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

    const result = await processTranscript(transcript);

    console.log('Result:', JSON.stringify(result, null, 2));

    expect(result).toHaveProperty('dailyNoteRichMarkdown');
    expect(result).toHaveProperty('todos');
    expect(result.todos.length).toBeGreaterThan(0);

    // Check for specific content we expect from the transcript
    const note = result.dailyNoteRichMarkdown.toLowerCase();
    expect(note).toContain('sherpa');
    expect(note).toContain('flow state');
  }, 120000); // 2 minute timeout
});
