import { Router } from 'express';
import { ReasoningOrchestrator, ReasoningState } from '../orchestrator.js';
import { LlamaLLMClient } from '../llm-client.js';
import { MCPNotionClient } from '../notion-client.js';
import {
  ProcessTranscriptRequestSchema,
  ProcessHighLevelRequestSchema,
} from '@flwst/types/api/reasoning';

/**
 * Phase 1: Process transcript with LLM only (no Notion matching)
 * Returns LLM-generated daily note and todos immediately.
 */
export const chatRouter = Router();

/**
 * Phase 1a: Extract high-level notes (Topics & Intent)
 */
chatRouter.post('/process/high-level', async (req, res) => {
  try {
    const parsed = ProcessHighLevelRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request: transcript is required' });
    }

    const { transcript, notionContext } = parsed.data;

    const llmClient = new LlamaLLMClient();
    const result = await llmClient.extractHighLevelNotes(transcript, notionContext);

    res.json(result);
  } catch (error: any) {
    console.error('Error extracting high-level notes:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

chatRouter.post('/process', async (req, res) => {
  try {
    // Validate request
    const parsed = ProcessTranscriptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request: transcript is required' });
    }

    const { transcript, notionContext } = parsed.data;

    console.log(
      `[process] notionContext projects=${notionContext?.projects?.length ?? 0} sampled=${notionContext?.sampledCount ?? 0}`,
    );

    // Use the new Orchestrator for processing
    const llmClient = new LlamaLLMClient();
    const notionClient = new MCPNotionClient();

    const orchestrator = new ReasoningOrchestrator(
      llmClient,
      notionClient,
      transcript,
      notionContext,
    );

    // Run the pipeline ONLY up to extraction
    // Matching and syncing are handled by other Phase 2/3 endpoints
    const result = await orchestrator.run(ReasoningState.TODOS_EXTRACTED);

    res.json(result);
  } catch (error: any) {
    console.error('Error processing transcript:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
