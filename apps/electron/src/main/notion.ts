/**
 * IPC handlers for Notion integration.
 */

import { ipcMain, shell } from 'electron';
import { APIErrorCode, APIResponseError, Client } from '@notionhq/client';
import type { CreateDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import type { NotionWorkspaceMetadata, OnboardingState } from '@flwst/types';
import { getLogger } from './sentry';
import { getConfigStore, getTokensStore } from './storage';
import { completeNotionOAuth } from './notionOAuth';
import {
  buildDailyNotesDbProperties,
  buildTasksDbProperties,
  normalizeNotionId,
} from './notionSchema';

const NOTION_VERSION = '2022-06-28';
const FLOW_STATE_PAGE_TITLE = 'flwst';
const DAILY_NOTES_DB_TITLE = 'Daily Notes';
const TASKS_DB_TITLE = 'To-Dos';

type CreateResourcesResult = {
  flowStatePageId: string;
  dailyNotesDbId: string;
  tasksDbId: string;
};

type NotionErrorCode =
  | 'NOTION_TOKEN_MISSING'
  | 'NOTION_PERMISSION_DENIED'
  | 'NOTION_PARENT_NOT_FOUND'
  | 'NOTION_RATE_LIMITED'
  | 'NOTION_VALIDATION_ERROR'
  | 'NOTION_NOT_SHARED_WITH_PARENT';

class NotionError extends Error {
  public readonly code: NotionErrorCode;

  constructor(code: NotionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const createResourcesInFlight = new Map<
  string,
  Promise<CreateResourcesResult>
>();

/**
 * Register Notion IPC handlers.
 * Should be called after storage is initialized.
 */
export function registerNotionHandlers(): void {
  const logger = getLogger();

  // Start Notion OAuth - opens browser and handles callback
  ipcMain.handle(
    'notion:startOAuth',
    async (): Promise<{ authUrl: string }> => {
      try {
        const { authUrl, result } = await completeNotionOAuth();

        logger.info('Starting Notion OAuth', {
          authUrl: authUrl.replace(process.env.NOTION_CLIENT_ID || '', '***'),
        });

        // Start OAuth flow in background (will handle callback)
        result
          .then(async (oauthResult) => {
            // Store OAuth result
            await handleOAuthResult(oauthResult);
            logger.info('Notion OAuth completed and stored');

            // Notify renderer that OAuth completed
            // Get all windows and send event
            const { BrowserWindow } = await import('electron');
            BrowserWindow.getAllWindows().forEach((window) => {
              window.webContents.send('notion:oauthComplete', {
                success: true,
              });
            });
          })
          .catch((error) => {
            logger.error('Notion OAuth failed', { error });

            // Notify renderer of OAuth failure
            import('electron').then(({ BrowserWindow }) => {
              BrowserWindow.getAllWindows().forEach((window) => {
                window.webContents.send('notion:oauthComplete', {
                  success: false,
                  error:
                    error instanceof Error ? error.message : 'Unknown error',
                });
              });
            });
          });

        // Open browser
        shell.openExternal(authUrl);

        return { authUrl };
      } catch (error) {
        logger.error('Failed to start Notion OAuth', { error });
        throw error;
      }
    },
  );

  /**
   * Helper to store OAuth result.
   */
  async function handleOAuthResult(result: {
    accessToken: string;
    workspace: NotionWorkspaceMetadata;
  }): Promise<void> {
    const tokensStore = getTokensStore();
    const currentTokens = await tokensStore.read();
    await tokensStore.write({
      ...currentTokens,
      notionAccessToken: result.accessToken,
    });

    const configStore = getConfigStore();
    const currentState = await configStore.read();
    const currentOnboarding = currentState.onboardingState;
    if (currentOnboarding) {
      await configStore.write({
        ...currentState,
        onboardingState: {
          ...currentOnboarding,
          notion: {
            ...currentOnboarding.notion,
            status: 'authed',
            workspace: result.workspace,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  // Store OAuth result (optional direct call)
  ipcMain.handle(
    'notion:storeOAuthResult',
    async (
      _event,
      result: { accessToken: string; workspace: NotionWorkspaceMetadata },
    ): Promise<void> => {
      try {
        const tokensStore = getTokensStore();
        const currentTokens = await tokensStore.read();
        await tokensStore.write({
          ...currentTokens,
          notionAccessToken: result.accessToken,
        });

        const configStore = getConfigStore();
        const currentState = await configStore.read();
        const currentOnboarding = currentState.onboardingState;
        if (currentOnboarding) {
          await configStore.write({
            ...currentState,
            onboardingState: {
              ...currentOnboarding,
              notion: {
                ...currentOnboarding.notion,
                status: 'authed',
                workspace: result.workspace,
                updatedAt: new Date().toISOString(),
              },
            },
          });
        }
        logger.info('Notion OAuth result stored');
      } catch (error) {
        logger.error('Failed to store Notion OAuth result', { error });
        throw error;
      }
    },
  );

  // Set parent page
  ipcMain.handle(
    'notion:setParentPage',
    async (_event, parentPageId: string): Promise<void> => {
      try {
        const normalizedParentId = normalizeNotionId(parentPageId);
        const configStore = getConfigStore();
        const currentState = await configStore.read();
        const currentOnboarding = currentState.onboardingState;
        if (currentOnboarding) {
          await configStore.write({
            ...currentState,
            onboardingState: {
              ...currentOnboarding,
              notion: {
                ...currentOnboarding.notion,
                parentPageId: normalizedParentId,
                status: 'parent_selected',
                updatedAt: new Date().toISOString(),
              },
            },
          });
        }
        logger.info('Notion parent page set', {
          parentPageId: normalizedParentId,
        });
      } catch (error) {
        const notionError = toNotionError(error);
        logger.error('Failed to set Notion parent page', {
          code: notionError.code,
          message: notionError.message,
        });
        throw notionError;
      }
    },
  );

  // Create resources (real Notion API)
  ipcMain.handle(
    'notion:createResources',
    async (
      _event,
      options: { parentPageId: string },
    ): Promise<{
      flowStatePageId: string;
      dailyNotesDbId: string;
      tasksDbId: string;
    }> => {
      try {
        const normalizedParentId = normalizeNotionId(options.parentPageId);
        const configStore = getConfigStore();
        const currentConfig = await configStore.read();
        const onboardingState = currentConfig.onboardingState;

        const workspaceId =
          onboardingState?.notion.workspace?.workspaceId ?? 'unknown';
        const inFlightKey = `${workspaceId}:${normalizedParentId}`;
        const inFlight = createResourcesInFlight.get(inFlightKey);
        if (inFlight) {
          return await inFlight;
        }

        const promise = createResourcesInternal(
          normalizedParentId,
          onboardingState,
        );
        createResourcesInFlight.set(inFlightKey, promise);
        try {
          return await promise;
        } finally {
          createResourcesInFlight.delete(inFlightKey);
        }
      } catch (error) {
        const notionError = toNotionError(error);
        logger.error('Failed to create Notion resources', {
          code: notionError.code,
          message: notionError.message,
        });
        throw notionError;
      }
    },
  );

  async function createResourcesInternal(
    parentPageId: string,
    onboardingState?: OnboardingState,
  ): Promise<CreateResourcesResult> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H1',
        location: 'src/main/notion.ts:createResourcesInternal:entry',
        message: 'createResourcesInternal entry',
        data: {
          parentPageId,
          onboardingStatus: onboardingState?.notion?.status,
          hasWorkspace: !!onboardingState?.notion?.workspace?.workspaceId,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    const tokensStore = getTokensStore();
    const tokens = await tokensStore.read();
    const accessToken = tokens.notionAccessToken;
    if (!accessToken) {
      throw new NotionError(
        'NOTION_TOKEN_MISSING',
        'Notion access token is missing.',
      );
    }

    const notion = new Client({
      auth: accessToken,
      notionVersion: NOTION_VERSION,
    });

    logger.info('Creating Notion resources', { parentPageId });

    const stored = resolveStoredIds(tokens, onboardingState);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H2',
        location: 'src/main/notion.ts:createResourcesInternal:stored',
        message: 'stored resource ids resolved',
        data: {
          hasFlowStatePageId: !!stored.flowStatePageId,
          hasDailyNotesDbId: !!stored.dailyNotesDbId,
          hasTasksDbId: !!stored.tasksDbId,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    if (stored.flowStatePageId && stored.dailyNotesDbId && stored.tasksDbId) {
      const verified = await verifyResources(notion, stored);
      if (verified) {
        logger.info('Notion resources already exist, skipping create', {
          flowStatePageId: stored.flowStatePageId,
          dailyNotesDbId: stored.dailyNotesDbId,
          tasksDbId: stored.tasksDbId,
        });
        await persistIds(stored, parentPageId, onboardingState);
        return stored;
      }
    }

    const existing = await findExistingResources(notion, parentPageId);
    if (
      existing.flowStatePageId &&
      existing.dailyNotesDbId &&
      existing.tasksDbId
    ) {
      logger.info('Found existing Notion resources', {
        flowStatePageId: existing.flowStatePageId,
        dailyNotesDbId: existing.dailyNotesDbId,
        tasksDbId: existing.tasksDbId,
      });
      await persistIds(existing, parentPageId, onboardingState);
      return existing;
    }

    const flowStatePageId =
      existing.flowStatePageId ??
      (await createFlowStatePage(notion, parentPageId));

    const dailyNotesDbId =
      existing.dailyNotesDbId ??
      (await createDailyNotesDatabase(notion, flowStatePageId));

    const tasksDbId =
      existing.tasksDbId ??
      (await createTasksDatabase(notion, flowStatePageId, dailyNotesDbId));

    await ensureDailyNotesRelation(notion, dailyNotesDbId, tasksDbId);

    const created = { flowStatePageId, dailyNotesDbId, tasksDbId };
    const smokeOk = await verifyResources(notion, created);
    if (!smokeOk) {
      throw new NotionError(
        'NOTION_VALIDATION_ERROR',
        'Created Notion resources could not be verified.',
      );
    }

    await persistIds(created, parentPageId, onboardingState);
    logger.info('Notion resources created', created);
    return created;
  }

  function resolveStoredIds(
    tokens: {
      notionPageId?: string;
      notionDailyNotesDbId?: string;
      notionTodosDbId?: string;
    },
    onboardingState?: OnboardingState,
  ): CreateResourcesResult {
    return {
      flowStatePageId:
        tokens.notionPageId ?? onboardingState?.notion.flowStatePageId ?? '',
      dailyNotesDbId:
        tokens.notionDailyNotesDbId ??
        onboardingState?.notion.dailyNotesDbId ??
        '',
      tasksDbId:
        tokens.notionTodosDbId ?? onboardingState?.notion.tasksDbId ?? '',
    };
  }

  async function verifyResources(
    notion: Client,
    resources: CreateResourcesResult,
  ): Promise<boolean> {
    try {
      await notion.pages.retrieve({
        page_id: normalizeNotionId(resources.flowStatePageId),
      });
      await notion.databases.retrieve({
        database_id: normalizeNotionId(resources.dailyNotesDbId),
      });
      await notion.databases.retrieve({
        database_id: normalizeNotionId(resources.tasksDbId),
      });
      return true;
    } catch {
      return false;
    }
  }

  async function findExistingResources(
    notion: Client,
    parentPageId: string,
  ): Promise<Partial<CreateResourcesResult>> {
    const result: Partial<CreateResourcesResult> = {};

    const pageSearch = await notion.search({
      query: FLOW_STATE_PAGE_TITLE,
      filter: { property: 'object', value: 'page' },
    });

    for (const item of pageSearch.results) {
      if (!('parent' in item)) {
        continue;
      }
      const parent = item.parent;
      if (
        parent.type === 'page_id' &&
        normalizeNotionId(parent.page_id) === parentPageId
      ) {
        result.flowStatePageId = item.id;
        break;
      }
    }

    if (!result.flowStatePageId) {
      return result;
    }

    const dbSearch = await notion.search({
      query: DAILY_NOTES_DB_TITLE,
      filter: { property: 'object', value: 'database' },
    });
    for (const item of dbSearch.results) {
      if (!('parent' in item)) {
        continue;
      }
      const parent = item.parent;
      if (
        parent.type === 'page_id' &&
        normalizeNotionId(parent.page_id) ===
          normalizeNotionId(result.flowStatePageId)
      ) {
        result.dailyNotesDbId = item.id;
        break;
      }
    }

    const tasksSearch = await notion.search({
      query: TASKS_DB_TITLE,
      filter: { property: 'object', value: 'database' },
    });
    for (const item of tasksSearch.results) {
      if (!('parent' in item)) {
        continue;
      }
      const parent = item.parent;
      if (
        parent.type === 'page_id' &&
        normalizeNotionId(parent.page_id) ===
          normalizeNotionId(result.flowStatePageId)
      ) {
        result.tasksDbId = item.id;
        break;
      }
    }

    return result;
  }

  async function createFlowStatePage(
    notion: Client,
    parentPageId: string,
  ): Promise<string> {
    const response = await notion.pages.create({
      parent: { page_id: parentPageId },
      properties: {
        title: {
          title: [{ text: { content: FLOW_STATE_PAGE_TITLE } }],
        },
      },
    });
    return response.id;
  }

  async function createDailyNotesDatabase(
    notion: Client,
    flowStatePageId: string,
  ): Promise<string> {
    const properties = ensureDatabaseProperties(buildDailyNotesDbProperties());
    const payload = {
      parent: { page_id: normalizeNotionId(flowStatePageId) },
      title: [{ type: 'text' as const, text: { content: DAILY_NOTES_DB_TITLE } }],
      properties,
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H3',
        location: 'src/main/notion.ts:createDailyNotesDatabase:properties',
        message: 'daily notes properties built',
        data: {
          keys: Object.keys(properties ?? {}),
          keyCount: Object.keys(properties ?? {}).length,
          payloadKeys: Object.keys(payload),
          payloadHasProperties: payload.properties !== undefined,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H6',
        location: 'src/main/notion.ts:createDailyNotesDatabase:call',
        message: 'calling databases.create for daily notes',
        data: {
          parentPageId: normalizeNotionId(flowStatePageId),
          title: DAILY_NOTES_DB_TITLE,
          propertyKeys: Object.keys(properties ?? {}),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    const response = await notion.databases.create(payload);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H6',
        location: 'src/main/notion.ts:createDailyNotesDatabase:success',
        message: 'successfully created daily notes database',
        data: {
          id: response.id,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    return response.id;
  }

  async function createTasksDatabase(
    notion: Client,
    flowStatePageId: string,
    dailyNotesDbId: string,
  ): Promise<string> {
    const properties = ensureDatabaseProperties(
      buildTasksDbProperties(dailyNotesDbId),
    );
    const payload = {
      parent: { page_id: normalizeNotionId(flowStatePageId) },
      title: [{ type: 'text' as const, text: { content: TASKS_DB_TITLE } }],
      properties,
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H4',
        location: 'src/main/notion.ts:createTasksDatabase:properties',
        message: 'tasks properties built',
        data: {
          keys: Object.keys(properties ?? {}),
          keyCount: Object.keys(properties ?? {}).length,
          payloadKeys: Object.keys(payload),
          payloadHasProperties: payload.properties !== undefined,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H7',
        location: 'src/main/notion.ts:createTasksDatabase:call',
        message: 'calling databases.create for tasks',
        data: {
          parentPageId: normalizeNotionId(flowStatePageId),
          title: TASKS_DB_TITLE,
          propertyKeys: Object.keys(properties ?? {}),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    try {
      const response = await notion.databases.create(payload);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre',
          hypothesisId: 'H7',
          location: 'src/main/notion.ts:createTasksDatabase:success',
          message: 'successfully created tasks database',
          data: {
            id: response.id,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
      return response.id;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre',
          hypothesisId: 'H7',
          location: 'src/main/notion.ts:createTasksDatabase:error',
          message: 'failed to create tasks database',
          data: {
            error: error instanceof Error ? error.message : String(error),
            code: (error as any).code,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
      throw error;
    }
  }

  async function ensureDailyNotesRelation(
    notion: Client,
    dailyNotesDbId: string,
    tasksDbId: string,
  ): Promise<void> {
    const properties: any = {
      Tasks: {
        relation: {
          database_id: normalizeNotionId(tasksDbId),
        },
      },
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H8',
        location: 'src/main/notion.ts:ensureDailyNotesRelation:call',
        message: 'calling databases.update for daily notes relation',
        data: {
          database_id: normalizeNotionId(dailyNotesDbId),
          propertyKeys: Object.keys(properties),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    try {
      await notion.databases.update({
        database_id: normalizeNotionId(dailyNotesDbId),
        properties,
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre',
          hypothesisId: 'H8',
          location: 'src/main/notion.ts:ensureDailyNotesRelation:success',
          message: 'successfully updated daily notes relation',
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre',
          hypothesisId: 'H8',
          location: 'src/main/notion.ts:ensureDailyNotesRelation:error',
          message: 'failed to update daily notes relation',
          data: {
            error: error instanceof Error ? error.message : String(error),
            code: (error as any).code,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
      throw error;
    }
  }

  function ensureDatabaseProperties(
    properties?: CreateDatabaseParameters['properties'],
  ): CreateDatabaseParameters['properties'] {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3e35c006-94a7-466a-acab-dce9d65a6631', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H5',
        location: 'src/main/notion.ts:ensureDatabaseProperties',
        message: 'ensureDatabaseProperties invoked',
        data: {
          hasProperties: !!properties,
          keyCount: properties ? Object.keys(properties).length : 0,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log
    if (properties && Object.keys(properties).length > 0) {
      return properties;
    }
    return {
      Name: { title: {} },
    };
  }

  async function persistIds(
    ids: CreateResourcesResult,
    parentPageId: string,
    onboardingState?: OnboardingState,
  ): Promise<void> {
    const tokensStore = getTokensStore();
    const currentTokens = await tokensStore.read();
    await tokensStore.write({
      ...currentTokens,
      notionPageId: ids.flowStatePageId,
      notionDailyNotesDbId: ids.dailyNotesDbId,
      notionTodosDbId: ids.tasksDbId,
    });

    const configStore = getConfigStore();
    const currentConfig = await configStore.read();
    const now = new Date().toISOString();
    const updatedOnboarding: OnboardingState = onboardingState ?? {
      onboardingCompleted: false,
      notion: { status: 'disconnected' },
      featureRequests: [],
    };

    await configStore.write({
      ...currentConfig,
      notion: {
        ...currentConfig.notion,
        flowStatePageId: ids.flowStatePageId,
        dailyNotesDbId: ids.dailyNotesDbId,
        todosDbId: ids.tasksDbId,
      },
      onboardingState: {
        ...updatedOnboarding,
        notion: {
          ...updatedOnboarding.notion,
          status: 'ready',
          parentPageId,
          flowStatePageId: ids.flowStatePageId,
          dailyNotesDbId: ids.dailyNotesDbId,
          tasksDbId: ids.tasksDbId,
          updatedAt: now,
          createdAt: updatedOnboarding.notion.createdAt ?? now,
        },
      },
    });
  }

  function toNotionError(error: unknown): NotionError {
    if (error instanceof NotionError) {
      return error;
    }
    if (error instanceof APIResponseError) {
      const code = mapApiErrorCode(error);
      return new NotionError(code, error.message);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NotionError('NOTION_VALIDATION_ERROR', message);
  }

  function mapApiErrorCode(error: APIResponseError): NotionErrorCode {
    if (error.code === APIErrorCode.Unauthorized) {
      return 'NOTION_TOKEN_MISSING';
    }
    if (error.code === APIErrorCode.Forbidden) {
      if (isNotionNotShared(error.message)) {
        return 'NOTION_NOT_SHARED_WITH_PARENT';
      }
      return 'NOTION_PERMISSION_DENIED';
    }
    if (error.code === APIErrorCode.ObjectNotFound) {
      return 'NOTION_PARENT_NOT_FOUND';
    }
    if (error.code === APIErrorCode.RateLimited) {
      return 'NOTION_RATE_LIMITED';
    }
    if (error.code === APIErrorCode.ValidationError) {
      return 'NOTION_VALIDATION_ERROR';
    }
    return 'NOTION_VALIDATION_ERROR';
  }

  function isNotionNotShared(message: string): boolean {
    return (
      message.toLowerCase().includes('not shared') ||
      message.toLowerCase().includes('not accessible')
    );
  }
}
