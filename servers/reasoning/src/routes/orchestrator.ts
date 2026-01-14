/**
 * Orchestrator Route
 *
 * New unified endpoint that uses the ReasoningOrchestrator to process
 * transcripts end-to-end with state machine orchestration.
 */

import { Router } from 'express';
import { ReasoningOrchestrator } from '../orchestrator.js';
import { LlamaLLMClient } from '../llm-client.js';
import { MCPNotionClient } from '../notion-client.js';
import { DailyNoteSchema } from '@flwst/types/src/api/reasoning';
import { z } from 'zod';

export const orchestratorRouter = Router();

/**
 * Request schema for orchestrator endpoint
 */
const ProcessTranscriptOrchestratorRequestSchema = z.object({
  transcript: z.string(),
  notionContext: z
    .object({
      seed: z.string(),
      sampledCount: z.number().int(),
      projects: z.array(z.string()),
      examples: z.array(
        z.object({
          project: z.string(),
          titles: z.array(z.string()),
        }),
      ),
      stats: z
        .object({
          total: z.number(),
          todo: z.number(),
          inProgress: z.number(),
          done: z.number(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * POST /api/orchestrator/process
 *
 * Process a transcript through the complete orchestration pipeline:
 * 1. Extract high-level notes
 * 2. Extract todos
 * 3. Match todos to Notion tasks
 * 4. Update matched task bodies
 * 5. Augment unmatched todos
 * 6. Sync to Notion
 */
orchestratorRouter.post('/process', async (req, res) => {
  try {
    // Validate request
    const parsed = ProcessTranscriptOrchestratorRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.errors,
      });
    }

    const { transcript, notionContext } = parsed.data;

    // Initialize clients
    const llmClient = new LlamaLLMClient();
    const notionClient = new MCPNotionClient();

    // Fetch Notion context if not provided
    let finalNotionContext = notionContext;
    if (!finalNotionContext) {
      try {
        finalNotionContext = await notionClient.fetchContext();
      } catch (err) {
        console.warn('[orchestrator] Failed to fetch Notion context, continuing without it:', err);
      }
    }

    // Create orchestrator
    const orchestrator = new ReasoningOrchestrator(
      llmClient,
      notionClient,
      transcript,
      finalNotionContext,
    );

    // Run the complete pipeline
    const result = await orchestrator.run();

    // Validate result
    const validated = DailyNoteSchema.parse(result);

    // Return result with orchestrator state for debugging
    res.json({
      ...validated,
      orchestrator: {
        state: orchestrator.getState(),
        logs: orchestrator.getStateSnapshot().logs,
        warnings: orchestrator.getStateSnapshot().warnings,
        errors: orchestrator.getStateSnapshot().errors,
      },
    });
  } catch (error: any) {
    console.error('[orchestrator] Error processing transcript:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
