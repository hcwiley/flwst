import { Router } from 'express';
import { processTranscript } from '../llm/model.js';

export const chatRouter = Router();

chatRouter.post('/process', async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const result = await processTranscript(transcript);
    res.json(result);
  } catch (error) {
    console.error('Error processing transcript:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
