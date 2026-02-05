/**
 * Sample Genkit flow wired for Firebase callable deployment.
 * Keeps a minimal, documented example for `genkit start` and onCallGenkit usage.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { onCallGenkit, hasClaim } from 'firebase-functions/https';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';

// Secrets are defined once and injected via Cloud Secret Manager at deploy time.
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Central Genkit client configured with the Gemini API provider.
const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model('gemini-2.5-flash'),
});

/**
 * Flow for generating short poems for demo/testing purposes.
 */
const generatePoemFlow = ai.defineFlow(
  {
    name: 'generatePoem',
    inputSchema: z.object({ subject: z.string() }),
    outputSchema: z.object({ poem: z.string() }),
  },
  async ({ subject }) => {
    const { text } = await ai.generate(`Compose a poem about ${subject}.`);
    return { poem: text };
  },
);

/**
 * Firebase callable wrapper for the sample flow with auth + secret enforcement.
 */
export const generatePoem = onCallGenkit(
  {
    secrets: [geminiApiKey],
    authPolicy: hasClaim('email_verified'),
  },
  generatePoemFlow,
);
