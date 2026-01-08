/**
 * Transcript Processor
 *
 * Handles preprocessing of raw transcripts by applying spelling corrections.
 * Blacklist filtering is now handled by the LLM via prompt instructions.
 */

import { spellingConfig } from '../../../../config/spelling';

export class TranscriptProcessor {
  /**
   * Processes a transcript by applying spelling corrections.
   */
  static process(transcript: string): string {
    // Apply spelling fixes (fix jargon and names)
    return this.applySpellingFixes(transcript);
  }

  /**
   * Applies spelling corrections based on the configuration.
   */
  private static applySpellingFixes(transcript: string): string {
    let result = transcript;

    for (const entry of spellingConfig.fix) {
      // Use word boundaries to avoid partial matches (e.g., "todo" in "autodose")
      // but only if the word is alphanumeric. For others, use simple replacement.
      const isAlphanumeric = /^[a-z0-9]+$/i.test(entry.word);
      const pattern = isAlphanumeric
        ? `\\b${this.escapeRegExp(entry.word)}\\b`
        : this.escapeRegExp(entry.word);

      const regex = new RegExp(pattern, 'gi');
      result = result.replace(regex, entry.replacement);
    }

    return result;
  }

  /**
   * Utility to escape string for use in RegExp
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
