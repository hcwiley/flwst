import { Router } from 'express';
import { processTranscript, extractHighLevelNotes } from '../llm/model.js';
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
    const result = await extractHighLevelNotes(transcript, notionContext);
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

    const { transcript, notionContext, highLevelNotes } = parsed.data;

    console.log(
      `[process] notionContext projects=${notionContext?.projects?.length ?? 0} sampled=${notionContext?.sampledCount ?? 0} highLevelNotes=${!!highLevelNotes}`,
    );

    // Process transcript with LLM only
    const result = await processTranscript(transcript, notionContext, highLevelNotes);

    res.json(result);
  } catch (error: any) {
    console.error('Error processing transcript:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});
