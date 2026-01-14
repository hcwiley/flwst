/**
 * Electron main Notion gateway.
 *
 * Centralizes Notion reads/writes in the Node process and exposes a
 * stateless interface for renderer-driven session data.
 */
import {
  BootstrapMirrorResponse,
  NotionSelectOption,
  NotionTodoCard,
  SubmitResult,
  SubmitSessionRequest,
  SubmitSessionResponse,
  SubmitOneRequest,
  SubmitOneResponse,
  TodoDraft,
} from '@flwst/types/src/api/reasoning';
import { extractNotionTaskProperties } from '../../../servers/reasoning/src/matching.js';
import { notionConfig } from '../../../config/notion.js';
import { MCPNotionClient } from '../../../servers/reasoning/src/notion-client.js';
import { notionApiClient } from '../../../servers/reasoning/src/notion-api.js';

type NotionGatewayDeps = {
  notionClient: MCPNotionClient;
  notionApiClient: {
    getDatabase: (databaseId: string) => Promise<any>;
    queryDatabase: (databaseId: string, filter?: any) => Promise<any>;
    createPage: (
      parent: { database_id: string },
      properties: any,
      children?: any[],
    ) => Promise<any>;
  };
  notionConfig: typeof notionConfig;
  now: () => Date;
};

type SubmitPlan = {
  action: 'create' | 'update' | 'skip';
  reason?: string;
};

const DEFAULT_DEPS: NotionGatewayDeps = {
  notionClient: new MCPNotionClient(),
  notionApiClient,
  notionConfig,
  now: () => new Date(),
};

/**
 * Decide how a draft todo should be submitted based on match state and flags.
 */
export function planTodoSubmission(draft: TodoDraft): SubmitPlan {
  if (!draft.includeInSubmit) {
    return { action: 'skip', reason: 'excluded_by_user' };
  }

  if (draft.matchState === 'ignored') {
    return { action: 'skip', reason: 'ignored' };
  }

  if (draft.matchState === 'ambiguous') {
    return { action: 'skip', reason: 'ambiguous' };
  }

  if (draft.matchState === 'matched') {
    if (!draft.notionTargetId && !draft.notionId) {
      return { action: 'skip', reason: 'missing_notion_target' };
    }
    return { action: 'update' };
  }

  return { action: 'create' };
}

/**
 * Gateway class that wraps Notion API/MCP calls for the Electron main process.
 */
export class NotionGateway {
  private todoFingerprintMap = new Map<string, string>();
  private dailyNoteFingerprintMap = new Map<string, string>();
  private deps: NotionGatewayDeps;

  constructor(deps: Partial<NotionGatewayDeps> = {}) {
    this.deps = { ...DEFAULT_DEPS, ...deps };
  }

  async bootstrapMirror(): Promise<BootstrapMirrorResponse> {
    const tasksDbId = this.deps.notionConfig?.databases?.tasks?.id;
    if (!tasksDbId) {
      throw new Error('Tasks database ID not found in notionConfig');
    }

    const db = (await this.deps.notionApiClient.getDatabase(tasksDbId)) as any;
    const projectOptions = this.getSelectOptions(db?.properties?.Project);
    const statusOptions = this.getSelectOptions(db?.properties?.Status);

    const tasks = (await this.deps.notionApiClient.queryDatabase(tasksDbId)) as any;
    const kanbanItems = (tasks.results || []).map((page: any): NotionTodoCard => {
      const props = extractNotionTaskProperties(page);
      return {
        id: props.id || page.id,
        title: props.name || 'Untitled',
        project: props.project,
        status: props.status,
        dueDate: props.dueDate,
        lastEditedTime: page.last_edited_time,
        notionUrl: props.url,
      };
    });

    return {
      projects: projectOptions,
      statuses: statusOptions,
      kanbanItems,
      lastSyncTime: this.deps.now().toISOString(),
    };
  }

  async refreshKanban(): Promise<{ kanbanItems: NotionTodoCard[]; lastSyncTime: string }> {
    const tasksDbId = this.deps.notionConfig?.databases?.tasks?.id;
    if (!tasksDbId) {
      throw new Error('Tasks database ID not found in notionConfig');
    }

    const tasks = (await this.deps.notionApiClient.queryDatabase(tasksDbId)) as any;
    const kanbanItems = (tasks.results || []).map((page: any): NotionTodoCard => {
      const props = extractNotionTaskProperties(page);
      return {
        id: props.id || page.id,
        title: props.name || 'Untitled',
        project: props.project,
        status: props.status,
        dueDate: props.dueDate,
        lastEditedTime: page.last_edited_time,
        notionUrl: props.url,
      };
    });

    return {
      kanbanItems,
      lastSyncTime: this.deps.now().toISOString(),
    };
  }

  async submitSession(payload: SubmitSessionRequest): Promise<SubmitSessionResponse> {
    const dailyNoteResult = await this.submitDailyNote(payload.dailyNoteDraft);
    const todoResults: SubmitResult[] = [];

    for (const draft of payload.todoDrafts) {
      const result = await this.submitTodoDraft(draft, dailyNoteResult.notionPageId);
      todoResults.push(result);
    }

    return {
      dailyNoteResult,
      todoResults,
    };
  }

  async submitOne(payload: SubmitOneRequest): Promise<SubmitOneResponse> {
    const result = await this.submitTodoDraft(payload.draft);
    return { result };
  }

  private async submitDailyNote(
    draft: SubmitSessionRequest['dailyNoteDraft'],
  ): Promise<SubmitResult> {
    if (!draft.includeInSubmit) {
      return { localId: draft.localId, status: 'success' };
    }

    const fingerprint = this.buildFingerprint(draft.sessionId, draft.localId);
    const existingId = this.dailyNoteFingerprintMap.get(fingerprint);
    if (existingId) {
      return { localId: draft.localId, status: 'success', notionPageId: existingId };
    }

    const dailyNotesDbId = this.deps.notionConfig?.databases?.dailyNotes?.id;
    if (!dailyNotesDbId) {
      return {
        localId: draft.localId,
        status: 'error',
        errorMessage: 'Daily notes database ID not found in notionConfig',
      };
    }

    const title = this.formatDailyNoteTitle(this.deps.now());
    const page = (await this.deps.notionApiClient.createPage(
      { database_id: dailyNotesDbId },
      {
        Name: {
          title: [{ text: { content: title } }],
        },
      },
      [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: draft.dailyNoteRichMarkdown } }],
          },
        },
      ],
    )) as any;

    this.dailyNoteFingerprintMap.set(fingerprint, page.id);
    return {
      localId: draft.localId,
      status: 'success',
      notionPageId: page.id,
    };
  }

  private async submitTodoDraft(draft: TodoDraft, dailyNoteId?: string): Promise<SubmitResult> {
    const plan = planTodoSubmission(draft);
    if (plan.action === 'skip') {
      return { localId: draft.localId, status: 'success' };
    }

    const fingerprint = this.buildFingerprint(draft.sessionId, draft.localId);
    if (plan.action === 'create') {
      const existingId = this.todoFingerprintMap.get(fingerprint);
      if (existingId) {
        return { localId: draft.localId, status: 'success', notionPageId: existingId };
      }
    }

    try {
      if (plan.action === 'update') {
        const notionTargetId = draft.notionTargetId ?? draft.notionId;
        if (!notionTargetId) {
          return {
            localId: draft.localId,
            status: 'error',
            errorMessage: 'Missing notionTargetId for matched todo',
          };
        }
        await this.deps.notionClient.updateTodo({
          id: draft.localId,
          text: draft.text,
          completed: draft.completed ?? false,
          status: draft.status,
          priority: draft.priority,
          project: draft.project,
          description: draft.description,
          dueDate: draft.dueDate,
          tags: draft.tags,
          assignee: draft.assignee,
          notionId: notionTargetId,
          notionUrl: draft.notionUrl,
          isMatched: true,
        });
        return { localId: draft.localId, status: 'success', notionPageId: notionTargetId };
      }

      const created = await this.deps.notionClient.createTodo(
        {
          id: draft.localId,
          text: draft.text,
          completed: draft.completed ?? false,
          status: draft.status,
          priority: draft.priority,
          project: draft.project,
          description: draft.description,
          dueDate: draft.dueDate,
          tags: draft.tags,
          assignee: draft.assignee,
          notionId: draft.notionId,
          notionUrl: draft.notionUrl,
          isMatched: false,
        },
        dailyNoteId,
      );
      this.todoFingerprintMap.set(fingerprint, created.id);
      return { localId: draft.localId, status: 'success', notionPageId: created.id };
    } catch (error) {
      return {
        localId: draft.localId,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Notion submit failed',
      };
    }
  }

  private getSelectOptions(property: any): NotionSelectOption[] {
    if (!property) return [];
    const options =
      property.select?.options ?? property.multi_select?.options ?? property.status?.options ?? [];
    return options
      .map((option: any) => ({
        id: option.id,
        name: option.name,
        color: option.color,
      }))
      .filter((option: NotionSelectOption) => option.name);
  }

  private buildFingerprint(sessionId: string, localId: string): string {
    return `${sessionId}:${localId}`;
  }

  private formatDailyNoteTitle(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      weekday: 'long',
    });
  }
}
