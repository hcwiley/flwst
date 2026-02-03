/**
 * Preprocess helpers for transcript cleanup.
 * Applies dictionary substitutions and ignore list removals when enabled.
 */

import type { PreprocessConfig } from '@flwst/types';

export interface PreprocessResult {
  content: string;
  applied: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyDictionary(
  input: string,
  dictionary: Record<string, string>,
): PreprocessResult {
  let output = input;
  const applied: string[] = [];

  for (const [from, to] of Object.entries(dictionary)) {
    if (!from) continue;
    const pattern = new RegExp(escapeRegExp(from), 'g');
    if (pattern.test(output)) {
      output = output.replace(pattern, to);
      applied.push(`dictionary:${from}->${to}`);
    }
  }

  return { content: output, applied };
}

function applyIgnoreList(
  input: string,
  ignoreList: string[],
): PreprocessResult {
  let output = input;
  const applied: string[] = [];

  for (const phrase of ignoreList) {
    if (!phrase) continue;
    const pattern = new RegExp(escapeRegExp(phrase), 'gi');
    if (pattern.test(output)) {
      output = output.replace(pattern, '');
      applied.push(`ignore:${phrase}`);
    }
  }

  return { content: output, applied };
}

/**
 * Apply preprocess transforms based on user config.
 */
export function applyPreprocess(
  input: string,
  config: PreprocessConfig,
): PreprocessResult {
  if (!config.enabled) {
    return { content: input, applied: [] };
  }

  const dictionaryResult = applyDictionary(input, config.dictionary);
  const ignoreResult = applyIgnoreList(
    dictionaryResult.content,
    config.ignoreList,
  );

  return {
    content: ignoreResult.content,
    applied: [...dictionaryResult.applied, ...ignoreResult.applied],
  };
}
