/**
 * Blacklist Configuration (Example)
 *
 * Defines patterns and phrases that should be removed from transcripts before processing.
 * Use this to filter out non-task related conversations or sensitive information.
 */

export const blacklistConfig = {
  // Regex patterns or exact phrases to remove
  patterns: [/pattern to remove/i, /another example/i, /talking to pet/i, /hi neighbor/i],

  // Specific projects or contexts that should be completely ignored if mentioned alone
  ignoredContexts: ['background noise', 'personal conversation'],
};
