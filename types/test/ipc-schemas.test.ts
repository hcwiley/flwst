/**
 * IPC schema validation tests.
 *
 * Verifies the shared Zod contracts accept valid payloads and reject
 * invalid shapes for the renderer <-> main boundary.
 */
import { describe, expect, it } from 'vitest';
import {
  BootstrapMirrorResponseSchema,
  DailyNoteDraftSchema,
  MatchStateSchema,
  NotionConnectResponseSchema,
  NotionStatusResponseSchema,
  ProcessTranscriptResponseSchema,
  SubmitResultSchema,
  TodoDraftSchema,
} from '../src/api/reasoning.js';

const baseTodoDraft = {
  id: 'todo-1',
  text: 'Follow up on specs',
  completed: false,
  localId: 'local-1',
  sessionId: 'session-1',
  matchState: 'new' as const,
};

const baseDailyNoteDraft = {
  localId: 'daily-1',
  sessionId: 'session-1',
  dailyNoteRichMarkdown: '## Daily Note\n- Item A',
};

describe('IPC schema validation', () => {
  it('accepts valid draft todo', () => {
    const parsed = TodoDraftSchema.parse(baseTodoDraft);
    expect(parsed.submitState).toBe('idle');
    expect(parsed.includeInSubmit).toBe(true);
  });

  it('rejects invalid match state', () => {
    expect(() =>
      TodoDraftSchema.parse({
        ...baseTodoDraft,
        matchState: 'unknown',
      }),
    ).toThrow();
    expect(() => MatchStateSchema.parse('unknown')).toThrow();
  });

  it('accepts valid process transcript response', () => {
    const payload = {
      dailyNoteDraft: DailyNoteDraftSchema.parse(baseDailyNoteDraft),
      todoDrafts: [TodoDraftSchema.parse(baseTodoDraft)],
      matchSuggestions: [
        {
          localId: 'local-1',
          matchState: 'new',
          confidence: 0.2,
        },
      ],
    };
    expect(() => ProcessTranscriptResponseSchema.parse(payload)).not.toThrow();
  });

  it('accepts valid bootstrap mirror response', () => {
    const payload = {
      projects: [{ id: 'p1', name: 'Project Alpha', color: 'blue' }],
      statuses: [{ id: 's1', name: 'TODO' }],
      kanbanItems: [
        {
          id: 'n1',
          title: 'Existing todo',
          status: 'TODO',
          project: 'Project Alpha',
        },
      ],
      lastSyncTime: '2025-01-01T00:00:00.000Z',
    };
    expect(() => BootstrapMirrorResponseSchema.parse(payload)).not.toThrow();
  });

  it('accepts valid Notion auth responses', () => {
    expect(() =>
      NotionStatusResponseSchema.parse({
        connected: true,
      }),
    ).not.toThrow();
    expect(() =>
      NotionConnectResponseSchema.parse({
        connected: false,
        error: 'Not connected',
      }),
    ).not.toThrow();
  });

  it('rejects submit result without localId', () => {
    expect(() =>
      SubmitResultSchema.parse({
        status: 'success',
      }),
    ).toThrow();
  });
});
