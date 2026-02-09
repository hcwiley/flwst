/**
 * Dedup gate: compare ingested task drafts to canonical tasks snapshot.
 * Outputs create/update/skip per draft with DB-scoped reconciliation.
 */

import type { DedupResult, NotionTaskPage } from '@flwst/types';
import { getLogger } from '../sentry';

/** Draft task from ingestion (minimal shape for matching and publish). */
export interface DraftTask {
  name: string;
  project?: string;
  description?: string;
  priority?: string;
  status?: string;
  tags?: string[];
  due?: string;
  assignee?: string;
  sourceRunId?: string;
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'to',
  'of',
  'for',
  'with',
  'on',
  'in',
  'at',
  'from',
  'by',
]);

const logger = getLogger();

/**
 * Build compact query tokens from text: proper nouns first, then general tokens.
 * Removes stop words, dedupes, caps at 12.
 */
export function buildQueryTokens(text: string): string[] {
  const rawTokens = text.split(/[\s/]+/);
  const normalize = (t: string): string =>
    t.toLowerCase().replace(/[^\w]/g, '');
  const isCandidate = (t: string): boolean =>
    t.length >= 3 && !STOP_WORDS.has(t);
  const isProperNoun = (raw: string): boolean => /^[A-Z][a-z]+/.test(raw);

  const proper = rawTokens
    .map((raw) => ({ raw, norm: normalize(raw) }))
    .filter(({ raw, norm }) => isCandidate(norm) && isProperNoun(raw))
    .map(({ norm }) => norm);

  const general = rawTokens.map(normalize).filter(isCandidate);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...proper, ...general]) {
    if (!seen.has(t)) {
      out.push(t);
      seen.add(t);
    }
  }
  return out.slice(0, 12);
}

/**
 * Reconcile MCP result IDs against the canonical snapshot.
 * Only returns tasks that exist in tasksById (DB-scoped).
 */
export function reconcileMcpIdsToSnapshot(
  mcpResultIds: string[],
  tasksById: Record<string, NotionTaskPage>,
): NotionTaskPage[] {
  const out: NotionTaskPage[] = [];
  for (const id of mcpResultIds) {
    const t = tasksById[id];
    if (t) out.push(t);
  }
  return out;
}

/**
 * Prefilter snapshot candidates by title substring and token overlap.
 */
type CandidateMatchReason = 'exact' | 'substring' | 'token_overlap';

type CandidateMatch = {
  task: NotionTaskPage;
  reason: CandidateMatchReason;
  overlap?: number;
};

function prefilterCandidates(
  draft: DraftTask,
  tasksById: Record<string, NotionTaskPage>,
): CandidateMatch[] {
  const draftTitle = draft.name.trim().toLowerCase();
  if (!draftTitle) return [];
  const draftTokens = new Set(buildQueryTokens(draft.name));
  const candidates: CandidateMatch[] = [];
  for (const task of Object.values(tasksById)) {
    const taskTitle = task.title.trim().toLowerCase();
    if (!taskTitle) continue;
    if (taskTitle === draftTitle) {
      candidates.push({ task, reason: 'exact' });
      continue;
    }
    if (taskTitle.includes(draftTitle) || draftTitle.includes(taskTitle)) {
      candidates.push({ task, reason: 'substring' });
      continue;
    }
    const taskTokens = buildQueryTokens(task.title);
    const overlap = taskTokens.filter((t) => draftTokens.has(t));
    if (overlap.length >= 2) {
      candidates.push({
        task,
        reason: 'token_overlap',
        overlap: overlap.length,
      });
    }
  }
  return candidates;
}

/**
 * Decide create/update/skip for a single draft against the snapshot.
 * No MCP call; uses local prefilter only. Deterministic reason string.
 */
export function dedupDraft(
  draft: DraftTask,
  tasksById: Record<string, NotionTaskPage>,
): DedupResult {
  const candidates = prefilterCandidates(draft, tasksById);
  if (candidates.length === 0) {
    return { action: 'create', reason: 'no_match' };
  }
  if (candidates.length === 1) {
    const exact =
      candidates[0].task.title.trim().toLowerCase() ===
      draft.name.trim().toLowerCase();
    if (exact) {
      return {
        action: 'update',
        matchedTaskId: candidates[0].task.id,
        reason: 'exact_match',
      };
    }
    logger.debug('Dedup fuzzy single-candidate: creating new task', {
      draft: draft.name,
      candidate: candidates[0].task.title,
      reason: candidates[0].reason,
      overlap: candidates[0].overlap,
    });
    return {
      action: 'create',
      matchedTaskId: candidates[0].task.id,
      reason: 'single_fuzzy_create',
    };
  }
  const exactMatch = candidates.find(
    (c) =>
      c.task.title.trim().toLowerCase() === draft.name.trim().toLowerCase(),
  );
  if (exactMatch) {
    return {
      action: 'update',
      matchedTaskId: exactMatch.task.id,
      reason: 'exact_match',
    };
  }
  logger.debug('Dedup multiple candidates: skipping draft', {
    draft: draft.name,
    candidates: candidates.map((c) => ({
      id: c.task.id,
      title: c.task.title,
      reason: c.reason,
      overlap: c.overlap,
    })),
  });
  return {
    action: 'skip',
    matchedTaskId: candidates[0].task.id,
    reason: 'multiple_candidates',
  };
}

/**
 * Run dedup gate for all drafts; returns one DedupResult per draft in order.
 */
export function runDedupGate(
  draftTasks: DraftTask[],
  tasksById: Record<string, NotionTaskPage>,
): DedupResult[] {
  return draftTasks.map((draft) => dedupDraft(draft, tasksById));
}
