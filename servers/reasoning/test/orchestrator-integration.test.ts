/**
 * Orchestrator Integration Test
 *
 * End-to-end test that uses the REAL LLM (not mocks) to process a transcript.
 * Uses the nov-17 test data to validate the complete pipeline.
 *
 * Run with: TEST_TYPE=integration pnpm test orchestrator-integration
 */

import { describe, it, expect } from 'vitest';
import { ReasoningOrchestrator } from '../src/orchestrator.js';
import { LlamaLLMClient } from '../src/llm-client.js';
import { MockNotionClient } from './mocks.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DailyNoteSchema, TodoSchema } from '@flwst/types/src/api/reasoning';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// REPO ROOT for loading fixtures
const REPO_ROOT = path.resolve(__dirname, '../../../');

/**
 * Load transcript from nov-17 test data
 */
function loadNov17Transcript(): string {
  const transcriptPath = path.resolve(REPO_ROOT, 'data/test/nov-17/transcript.txt');
  return fs.readFileSync(transcriptPath, 'utf-8');
}

/**
 * Load fixture expectations
 */
function loadNov17Fixture() {
  const fixturePath = path.resolve(REPO_ROOT, 'data/test/nov-17/fixture.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  return {
    todoUrls: fixture.todo_urls || [],
    dailyNoteUrl: fixture.daily_note_url,
    noteSummary: fixture.note_sumamry || fixture.note_summary || '', // Handle typo in fixture
  };
}

// Only run if explicitly requested (these are slow and require the model)
const isIntegration = process.env.TEST_TYPE === 'integration';

describe.skipIf(!isIntegration)('Orchestrator Integration Test (Real LLM)', () => {
  it('should process nov-17 transcript end-to-end with real LLM', async () => {
    const transcript = loadNov17Transcript();
    const fixture = loadNov17Fixture();

    // Use REAL LLM client
    const llmClient = new LlamaLLMClient();

    // Use mock Notion client (we're testing LLM, not Notion API)
    const notionClient = new MockNotionClient();

    // Create orchestrator
    const orchestrator = new ReasoningOrchestrator(llmClient, notionClient, transcript);

    // Run the complete pipeline
    const result = await orchestrator.run();

    // Validate result structure
    const validated = DailyNoteSchema.parse(result);
    expect(validated.dailyNoteRichMarkdown.length).toBeGreaterThan(0);
    expect(validated.todos.length).toBeGreaterThan(0);

    // Validate each todo
    for (const todo of validated.todos) {
      TodoSchema.parse(todo);
      expect(todo.id).toBeDefined();
      expect(todo.text).toBeDefined();
      expect(todo.text.length).toBeGreaterThan(0);
    }

    // Check that we extracted expected todos based on the transcript
    const todoTexts = validated.todos.map((t) => t.text.toLowerCase());

    // Expected todos from the transcript (based on fixture and transcript content):
    // - "overhauling flow state command process" / "flow state import"
    // - "ML kit object identification" / "milk kit piece"
    // - "Whole Foods buy turkey check Campo Grande pork"
    // - "Run flwst locally with Llama3 backend"
    // - "Research flwst MCP interactions"
    // - Instagram posts (multiple)

    // Check for key todos mentioned in transcript
    const hasFlowStateTodo = todoTexts.some(
      (t) =>
        t.includes('flow state') &&
        (t.includes('import') || t.includes('command') || t.includes('overhaul')),
    );
    const hasMLKitTodo = todoTexts.some(
      (t) => t.includes('ml kit') || t.includes('milk kit') || t.includes('object identification'),
    );
    const hasWholeFoodsTodo = todoTexts.some(
      (t) => t.includes('whole foods') || (t.includes('turkey') && t.includes('campo')),
    );
    const hasLocalLlamaTodo = todoTexts.some(
      (t) => t.includes('local') && (t.includes('llama') || t.includes('flwst')),
    );
    const hasInstagramTodo = todoTexts.some((t) => t.includes('instagram') && t.includes('post'));

    // Log what we found for debugging
    console.log('\n=== Extracted Todos ===');
    validated.todos.forEach((todo, i) => {
      console.log(`${i + 1}. ${todo.text} (project: ${todo.project || 'N/A'})`);
    });
    console.log('\n=== Expected Todos Check ===');
    console.log(`Flow State todo: ${hasFlowStateTodo ? '✓' : '✗'}`);
    console.log(`ML Kit todo: ${hasMLKitTodo ? '✓' : '✗'}`);
    console.log(`Whole Foods todo: ${hasWholeFoodsTodo ? '✓' : '✗'}`);
    console.log(`Local Llama todo: ${hasLocalLlamaTodo ? '✓' : '✗'}`);
    console.log(`Instagram todo: ${hasInstagramTodo ? '✓' : '✗'}`);

    // We expect at least some of these key todos to be extracted
    // (LLM might phrase them differently, so we're lenient)
    const keyTodosFound = [
      hasFlowStateTodo,
      hasMLKitTodo,
      hasWholeFoodsTodo,
      hasLocalLlamaTodo,
      hasInstagramTodo,
    ].filter(Boolean).length;
    expect(keyTodosFound).toBeGreaterThanOrEqual(2); // At least 2 of the key todos should be found

    // Validate daily note contains expected themes
    const noteLower = validated.dailyNoteRichMarkdown.toLowerCase();
    const hasFlowStateMention = noteLower.includes('flow state');
    const hasMLKitMention = noteLower.includes('ml kit') || noteLower.includes('milk kit');
    const hasSmartTakeMention = noteLower.includes('smart take');

    expect(hasFlowStateMention || hasMLKitMention || hasSmartTakeMention).toBe(true);

    // Validate orchestrator completed successfully
    expect(orchestrator.getState()).toBe('DONE');
    const snapshot = orchestrator.getStateSnapshot();
    expect(snapshot.errors.length).toBe(0); // No errors should occur

    // Check that todos were matched (even if to mock Notion tasks)
    const matchedCount = validated.todos.filter((t) => t.isMatched).length;
    console.log(`\nMatched ${matchedCount} of ${validated.todos.length} todos to Notion`);

    // Check that augmentation happened for unmatched todos
    const unmatchedTodos = validated.todos.filter((t) => !t.isMatched);
    if (unmatchedTodos.length > 0) {
      console.log(`\nUnmatched todos (should be augmented): ${unmatchedTodos.length}`);
      // Augmented todos should have enhanced descriptions
      for (const todo of unmatchedTodos) {
        if (todo.description) {
          expect(todo.description.length).toBeGreaterThan(0);
        }
      }
    }

    // Validate project assignments are reasonable
    const projects = new Set(validated.todos.map((t) => t.project).filter(Boolean));
    console.log(`\nProjects found: ${Array.from(projects).join(', ')}`);
    // Should have at least "flwst" or "flow state" project, and possibly "Personal"
    expect(projects.size).toBeGreaterThan(0);

    // Summary validation - check that the daily note summary aligns with fixture expectations
    // The fixture says: "Streamlined flwst import/update to reduce duplicate tasks; MLKit object-id is a blocker; set up daily Instagram posting cadence."
    const noteSummary = validated.dailyNoteRichMarkdown.toLowerCase();
    const fixtureSummary = fixture.noteSummary.toLowerCase();

    // Extract key themes from fixture summary
    const hasImportUpdateMention = noteSummary.includes('import') || noteSummary.includes('update');
    const hasMLKitBlockerMention =
      noteSummary.includes('ml kit') || noteSummary.includes('blocker');
    const hasInstagramMention = noteSummary.includes('instagram');
    const hasFlwstMention = noteSummary.includes('flwst') || noteSummary.includes('flow state');

    console.log('\n=== Daily Note Summary Check ===');
    console.log(`Fixture summary: "${fixture.noteSummary}"`);
    console.log(`Import/update mention: ${hasImportUpdateMention ? '✓' : '✗'}`);
    console.log(`ML Kit blocker mention: ${hasMLKitBlockerMention ? '✓' : '✗'}`);
    console.log(`Instagram mention: ${hasInstagramMention ? '✓' : '✗'}`);
    console.log(`Flwst/Flow State mention: ${hasFlwstMention ? '✓' : '✗'}`);

    // At least one of these themes should be present (based on fixture summary)
    expect(
      hasImportUpdateMention || hasMLKitBlockerMention || hasInstagramMention || hasFlwstMention,
    ).toBe(true);

    // Log the full daily note for manual inspection
    console.log('\n=== Full Daily Note ===');
    console.log(validated.dailyNoteRichMarkdown.substring(0, 500) + '...');
  }, 300000); // 5 minute timeout for real LLM inference
});
