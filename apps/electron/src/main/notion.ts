/**
 * IPC handlers for Notion integration.
 */

import { ipcMain, shell } from 'electron';
import { APIErrorCode, APIResponseError, Client } from '@notionhq/client';
import type { NotionWorkspaceMetadata, OnboardingState } from '@flwst/types';
import { getLogger } from './sentry';
import { getConfigStore, getTokensStore } from './storage';
import { completeNotionOAuth } from './notionOAuth';
import {
  buildDailyNotesDbProperties,
  buildTasksDbProperties,
  normalizeNotionId,
} from './notionSchema';
import type { NotionDatabaseProperties } from './notionTypes';

const logger = getLogger();
const FLOW_STATE_PAGE_TITLE = 'flwst';
const DAILY_NOTES_DB_TITLE = 'Daily Notes';
const TASKS_DB_TITLE = 'To-Dos';

type CreateResourcesResult = {
  flowStatePageId: string;
  dailyNotesDataSourceId: string;
  tasksDataSourceId: string;
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

type NotionPropertyEntry = {
  key: string;
  type: string;
};

type NotionPropertyTypes = Record<string, string>;

function getPropertyType(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return 'unknown';
  }
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0 ? keys[0] : 'unknown';
}

function buildExpectedPropertyTypes(
  dailyNotesDataSourceId: string,
  tasksDataSourceId: string,
): { daily: NotionPropertyTypes; tasks: NotionPropertyTypes } {
  const daily = buildDailyNotesDbProperties(tasksDataSourceId);
  const tasks = buildTasksDbProperties(dailyNotesDataSourceId);

  const dailyTypes = Object.fromEntries(
    Object.entries(daily).map(([key, value]) => [key, getPropertyType(value)]),
  );
  const tasksTypes = Object.fromEntries(
    Object.entries(tasks).map(([key, value]) => [key, getPropertyType(value)]),
  );

  return { daily: dailyTypes, tasks: tasksTypes };
}

function buildExpectedProperties(
  dailyNotesDataSourceId: string,
  tasksDataSourceId: string,
): { daily: NotionDatabaseProperties; tasks: NotionDatabaseProperties } {
  return {
    daily: buildDailyNotesDbProperties(tasksDataSourceId),
    tasks: buildTasksDbProperties(dailyNotesDataSourceId),
  };
}

function diffPropertyTypes(
  expected: NotionPropertyTypes,
  actual: NotionPropertyEntry[],
): {
  missing: string[];
  typeMismatches: { key: string; expected: string; actual: string }[];
  extras: string[];
} {
  const actualMap = new Map(actual.map((entry) => [entry.key, entry.type]));
  const expectedKeys = Object.keys(expected);
  const actualKeys = actual.map((entry) => entry.key);

  const missing = expectedKeys.filter((key) => !actualMap.has(key));
  const typeMismatches = expectedKeys
    .filter((key) => actualMap.has(key))
    .map((key) => ({
      key,
      expected: expected[key],
      actual: actualMap.get(key) ?? 'unknown',
    }))
    .filter((entry) => entry.expected !== entry.actual);
  const extras = actualKeys.filter((key) => !expectedKeys.includes(key));

  return { missing, typeMismatches, extras };
}

function pickMissingProperties(
  expected: NotionDatabaseProperties,
  actual: NotionPropertyEntry[],
): NotionDatabaseProperties {
  const actualKeys = new Set(actual.map((entry) => entry.key));
  return Object.fromEntries(
    Object.entries(expected).filter(([key]) => !actualKeys.has(key)),
  ) as NotionDatabaseProperties;
}

function getDataSourcesClient(notion: Client): {
  retrieve: (params: { data_source_id: string }) => Promise<unknown>;
  update: (params: {
    data_source_id: string;
    properties: NotionDatabaseProperties;
  }) => Promise<unknown>;
} {
  const dataSources = (notion as { dataSources?: unknown }).dataSources as
    | {
        retrieve: (params: { data_source_id: string }) => Promise<unknown>;
        update: (params: {
          data_source_id: string;
          properties: NotionDatabaseProperties;
        }) => Promise<unknown>;
      }
    | undefined;
  if (!dataSources) {
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:getDataSourcesClient:missing',
      message: 'Notion SDK dataSources client missing',
      data: {
        clientKeys: Object.keys(notion as unknown as Record<string, unknown>),
      },
      timestamp: Date.now(),
    });
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      'Notion SDK dataSources client missing. Update dependency/build.',
    );
  }
  return dataSources;
}

async function resolvePrimaryDataSourceId(
  notion: Client,
  databaseId: string,
  label: 'daily_notes' | 'tasks',
): Promise<string> {
  const database = await notion.databases.retrieve({
    database_id: normalizeNotionId(databaseId),
  });
  const responseKeys = Object.keys(database as Record<string, unknown>);
  const dataSources = (database as { data_sources?: { id?: string }[] })
    .data_sources;
  const dataSourcesCount = Array.isArray(dataSources) ? dataSources.length : 0;
  const dataSourceId = dataSources?.[0]?.id ?? '';
  // DEBUG: notion-onboarding
  logger.debug('notion-onboarding', {
    sessionId: 'debug-session',
    runId: 'pre',
    hypothesisId: 'H12',
    location: 'src/main/notion.ts:resolvePrimaryDataSourceId',
    message: 'resolved data source id for database',
    data: {
      label,
      databaseId,
      dataSourcesCount,
      dataSourceId,
      responseKeys,
    },
    timestamp: Date.now(),
  });
  if (!dataSourceId) {
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      'Notion database missing data_sources; only data source schema supported.',
    );
  }
  return dataSourceId;
}

async function fetchDataSourceSchemaEntries(
  notion: Client,
  dataSourceId: string,
  label: 'daily_notes' | 'tasks',
): Promise<NotionPropertyEntry[]> {
  try {
    const dataSources = getDataSourcesClient(notion);
    const dataSource = (await dataSources.retrieve({
      data_source_id: dataSourceId,
    })) as { properties?: Record<string, { type?: string }>; object?: string };
    const properties = (dataSource.properties ?? {}) as Record<
      string,
      { type?: string }
    >;
    const entries = Object.entries(properties).map(([key, value]) => ({
      key,
      type: value.type ?? 'unknown',
    }));
    const objectType = dataSource.object ?? 'unknown';
    const responseKeys = Object.keys(dataSource as Record<string, unknown>);
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:fetchDataSourceSchemaEntries',
      message: 'data source schema snapshot (startup)',
      data: {
        label,
        dataSourceId,
        objectType,
        responseKeys,
        propertyCount: entries.length,
        properties: entries,
      },
      timestamp: Date.now(),
    });
    return entries;
  } catch (error) {
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:fetchDataSourceSchemaEntries:error',
      message: 'failed to retrieve data source schema (startup)',
      data: {
        label,
        error: error instanceof Error ? error.message : String(error),
        code: (error as any).code,
      },
      timestamp: Date.now(),
    });
    return [];
  }
}

/**
 * Fetch full data source schema with property configurations.
 * Returns the full properties object for detailed comparison.
 */
async function fetchDataSourceFullSchema(
  notion: Client,
  dataSourceId: string,
  label: 'daily_notes' | 'tasks',
): Promise<Record<string, any>> {
  try {
    const dataSources = getDataSourcesClient(notion);
    const dataSource = (await dataSources.retrieve({
      data_source_id: dataSourceId,
    })) as { properties?: Record<string, any> };
    return (dataSource.properties ?? {}) as Record<string, any>;
  } catch (error) {
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:fetchDataSourceFullSchema:error',
      message: 'failed to retrieve full data source schema',
      data: {
        label,
        error: error instanceof Error ? error.message : String(error),
      },
      timestamp: Date.now(),
    });
    return {};
  }
}

/**
 * Check if select/multi-select options need to be updated.
 * Returns properties that need option updates.
 */
function findPropertiesNeedingOptionUpdates(
  expected: NotionDatabaseProperties,
  actualFull: Record<string, any>,
): NotionDatabaseProperties {
  const needsUpdate: NotionDatabaseProperties = {};

  for (const [propName, expectedProp] of Object.entries(expected)) {
    const actualProp = actualFull[propName];
    if (!actualProp) continue; // Property doesn't exist yet, will be handled by missing check

    // Check select properties
    if ('select' in expectedProp && actualProp.type === 'select') {
      const expectedOptions = expectedProp.select.options || [];
      const actualOptions = (actualProp.select?.options || []) as Array<{
        name: string;
        id?: string;
        color?: string;
      }>;

      // Check if we need to add new options or if options are missing
      const actualNames = new Set(actualOptions.map((o) => o.name));

      const missingOptions = expectedOptions.filter(
        (opt) => !actualNames.has(opt.name),
      );

      if (missingOptions.length > 0) {
        // Include existing options (by ID) + new options
        const existingOptions = actualOptions.map((opt) => ({
          name: opt.name,
          id: opt.id,
        }));
        needsUpdate[propName] = {
          select: {
            options: [...existingOptions, ...missingOptions],
          },
        };
      }
    }

    // Check multi-select properties
    if ('multi_select' in expectedProp && actualProp.type === 'multi_select') {
      const expectedOptions = expectedProp.multi_select.options || [];
      const actualOptions = (actualProp.multi_select?.options || []) as Array<{
        name: string;
        id?: string;
        color?: string;
      }>;

      const actualNames = new Set(actualOptions.map((o) => o.name));

      const missingOptions = expectedOptions.filter(
        (opt) => !actualNames.has(opt.name),
      );

      if (missingOptions.length > 0) {
        const existingOptions = actualOptions.map((opt) => ({
          name: opt.name,
          id: opt.id,
        }));
        needsUpdate[propName] = {
          multi_select: {
            options: [...existingOptions, ...missingOptions],
          },
        };
      }
    }
  }

  return needsUpdate;
}

async function ensureDataSourcePropertiesOnStartup(
  notion: Client,
  dataSourceId: string,
  label: 'daily_notes' | 'tasks',
  expected: NotionDatabaseProperties,
  actual: NotionPropertyEntry[],
): Promise<void> {
  const missing = pickMissingProperties(expected, actual);
  const missingKeys = Object.keys(missing);

  // Also check if existing properties need option updates
  const actualFull = await fetchDataSourceFullSchema(
    notion,
    dataSourceId,
    label,
  );
  const needsOptionUpdate = findPropertiesNeedingOptionUpdates(
    expected,
    actualFull,
  );
  const needsOptionUpdateKeys = Object.keys(needsOptionUpdate);

  if (missingKeys.length === 0 && needsOptionUpdateKeys.length === 0) {
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:ensureDataSourcePropertiesOnStartup:skip',
      message: 'no missing properties or option updates needed on startup',
      data: {
        label,
      },
      timestamp: Date.now(),
    });
    return;
  }

  try {
    const dataSources = getDataSourcesClient(notion);

    // Combine missing properties and option updates
    const propertiesToUpdate = { ...missing, ...needsOptionUpdate };
    const allUpdateKeys = Object.keys(propertiesToUpdate);

    // Log relation properties before sending
    const relationProps = Object.entries(propertiesToUpdate).filter(
      ([_, value]) => 'relation' in value,
    );

    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:ensureDataSourcePropertiesOnStartup:call',
      message: 'updating properties on startup',
      data: {
        label,
        dataSourceId,
        missingKeys,
        needsOptionUpdateKeys,
        allUpdateKeys,
        payloadKeys: Object.keys(propertiesToUpdate),
        relationProperties: relationProps.map(([key, value]) => ({
          key,
          config: 'relation' in value ? value.relation : null,
        })),
      },
      timestamp: Date.now(),
    });

    const updateResponse = (await dataSources.update({
      data_source_id: dataSourceId,
      properties: propertiesToUpdate,
    })) as { properties?: Record<string, { type?: string }> };
    const responseProperties = (updateResponse.properties ?? {}) as Record<
      string,
      { type?: string }
    >;
    const responsePropertyCount = Object.keys(responseProperties).length;
    const responseKeys = Object.keys(updateResponse as Record<string, unknown>);
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location:
        'src/main/notion.ts:ensureDataSourcePropertiesOnStartup:success',
      message: 'updated properties on startup',
      data: {
        label,
        missingKeys,
        needsOptionUpdateKeys,
        allUpdateKeys,
        responsePropertyCount,
        responseKeys,
      },
      timestamp: Date.now(),
    });

    await fetchDataSourceSchemaEntries(notion, dataSourceId, label);
  } catch (error) {
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:ensureDataSourcePropertiesOnStartup:error',
      message: 'failed to update properties on startup',
      data: {
        label,
        error: error instanceof Error ? error.message : String(error),
        code: (error as any).code,
      },
      timestamp: Date.now(),
    });
  }
}

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
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H8',
      location: 'src/main/notion.ts:handleOAuthResult:entry',
      message: 'handleOAuthResult entry',
      data: {
        hasAccessToken: !!result.accessToken,
        hasWorkspaceId: !!result.workspace?.workspaceId,
      },
      timestamp: Date.now(),
    });
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
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H8',
      location: 'src/main/notion.ts:handleOAuthResult:stored',
      message: 'handleOAuthResult stored tokens and onboarding',
      data: {
        hadOnboardingState: !!currentOnboarding,
        statusSet: currentOnboarding ? 'authed' : 'skipped',
      },
      timestamp: Date.now(),
    });
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
      dailyNotesDataSourceId: string;
      tasksDataSourceId: string;
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
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
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
    });
    const tokensStore = getTokensStore();
    const tokens = await tokensStore.read();
    const accessToken = tokens.notionAccessToken;
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H9',
      location: 'src/main/notion.ts:createResourcesInternal:token',
      message: 'token presence before create',
      data: {
        hasAccessToken: !!accessToken,
      },
      timestamp: Date.now(),
    });
    if (!accessToken) {
      throw new NotionError(
        'NOTION_TOKEN_MISSING',
        'Notion access token is missing.',
      );
    }

    const notion = new Client({
      auth: accessToken,
    });

    logger.info('Creating Notion resources', { parentPageId });

    const stored = resolveStoredIds(tokens, onboardingState);
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H2',
      location: 'src/main/notion.ts:createResourcesInternal:stored',
      message: 'stored resource ids resolved',
      data: {
        hasFlowStatePageId: !!stored.flowStatePageId,
        hasDailyNotesDataSourceId: !!stored.dailyNotesDataSourceId,
        hasTasksDataSourceId: !!stored.tasksDataSourceId,
      },
      timestamp: Date.now(),
    });
    if (
      stored.flowStatePageId &&
      stored.dailyNotesDataSourceId &&
      stored.tasksDataSourceId
    ) {
      const verified = await verifyResources(notion, stored);
      if (verified) {
        logger.info('Notion resources already exist, skipping create', {
          flowStatePageId: stored.flowStatePageId,
          dailyNotesDataSourceId: stored.dailyNotesDataSourceId,
          tasksDataSourceId: stored.tasksDataSourceId,
        });
        await persistIds(stored, parentPageId, onboardingState);
        return stored;
      }
    }

    const existing = await findExistingResources(notion, parentPageId);
    if (
      existing.flowStatePageId &&
      existing.dailyNotesDataSourceId &&
      existing.tasksDataSourceId
    ) {
      logger.info('Found existing Notion resources', {
        flowStatePageId: existing.flowStatePageId,
        dailyNotesDataSourceId: existing.dailyNotesDataSourceId,
        tasksDataSourceId: existing.tasksDataSourceId,
      });
      const existingFull = existing as CreateResourcesResult;
      await persistIds(existingFull, parentPageId, onboardingState);
      return existingFull;
    }

    const flowStatePageId =
      existing.flowStatePageId ??
      (await createFlowStatePage(notion, parentPageId));

    let dailyNotesDataSourceId = existing.dailyNotesDataSourceId;
    if (!dailyNotesDataSourceId) {
      const dailyNotesDbId = await createDailyNotesDatabase(
        notion,
        flowStatePageId,
      );
      dailyNotesDataSourceId = await resolvePrimaryDataSourceId(
        notion,
        dailyNotesDbId,
        'daily_notes',
      );
      // Add all properties after database creation
      await addDatabaseProperties(
        notion,
        dailyNotesDataSourceId,
        buildDailyNotesDbProperties(),
        'daily_notes',
      );
    }

    let tasksDataSourceId = existing.tasksDataSourceId;
    if (!tasksDataSourceId) {
      const tasksDbId = await createTasksDatabase(notion, flowStatePageId);
      tasksDataSourceId = await resolvePrimaryDataSourceId(
        notion,
        tasksDbId,
        'tasks',
      );
      // Add all properties after database creation
      await addDatabaseProperties(
        notion,
        tasksDataSourceId,
        buildTasksDbProperties(),
        'tasks',
      );
    }

    await ensureDailyNotesRelation(
      notion,
      dailyNotesDataSourceId,
      tasksDataSourceId,
    );

    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:createResourcesInternal:postRelation',
      message: 'relation update completed, retrieving schemas',
      data: {
        dailyNotesDataSourceId,
        tasksDataSourceId,
      },
      timestamp: Date.now(),
    });
    await logDatabaseSchemaByDataSourceId(
      notion,
      dailyNotesDataSourceId,
      'daily_notes',
    );
    await logDatabaseSchemaByDataSourceId(notion, tasksDataSourceId, 'tasks');

    const created = {
      flowStatePageId,
      dailyNotesDataSourceId,
      tasksDataSourceId,
    };
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
      notionDailyNotesDataSourceId?: string;
      notionTodosDataSourceId?: string;
    },
    onboardingState?: OnboardingState,
  ): CreateResourcesResult {
    return {
      flowStatePageId:
        tokens.notionPageId ?? onboardingState?.notion.flowStatePageId ?? '',
      dailyNotesDataSourceId:
        tokens.notionDailyNotesDataSourceId ??
        onboardingState?.notion.dailyNotesDataSourceId ??
        '',
      tasksDataSourceId:
        tokens.notionTodosDataSourceId ??
        onboardingState?.notion.tasksDataSourceId ??
        '',
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
      const dataSources = getDataSourcesClient(notion);
      await dataSources.retrieve({
        data_source_id: resources.dailyNotesDataSourceId,
      });
      await dataSources.retrieve({
        data_source_id: resources.tasksDataSourceId,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function logDatabaseSchemaByDataSourceId(
    notion: Client,
    dataSourceId: string,
    label: 'daily_notes' | 'tasks',
  ): Promise<void> {
    try {
      const dataSources = getDataSourcesClient(notion);
      const dataSource = (await dataSources.retrieve({
        data_source_id: dataSourceId,
      })) as {
        properties?: Record<string, { type?: string }>;
        object?: string;
      };
      const properties = (dataSource.properties ?? {}) as Record<
        string,
        { type?: string }
      >;
      const entries = Object.entries(properties).map(([key, value]) => ({
        key,
        type: value.type ?? 'unknown',
      }));
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H12',
        location: 'src/main/notion.ts:logDatabaseSchemaByDataSourceId',
        message: 'data source schema snapshot',
        data: {
          label,
          dataSourceId,
          propertyCount: entries.length,
          properties: entries,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H12',
        location: 'src/main/notion.ts:logDatabaseSchemaByDataSourceId:error',
        message: 'failed to retrieve data source schema',
        data: {
          label,
          error: error instanceof Error ? error.message : String(error),
          code: (error as any).code,
        },
        timestamp: Date.now(),
      });
    }
  }

  async function findExistingResources(
    notion: Client,
    parentPageId: string,
  ): Promise<Partial<CreateResourcesResult>> {
    const result: Partial<CreateResourcesResult> = {};

    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H5',
      location: 'src/main/notion.ts:findExistingResources:pageSearch',
      message: 'searching for flow state page',
      data: {
        query: FLOW_STATE_PAGE_TITLE,
        filterValue: 'page',
      },
      timestamp: Date.now(),
    });
    const pageSearch = await notion.search({
      query: FLOW_STATE_PAGE_TITLE,
      filter: { property: 'object', value: 'page' } as any,
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

    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H5',
      location: 'src/main/notion.ts:findExistingResources:dbSearch',
      message: 'searching for daily notes database',
      data: {
        query: DAILY_NOTES_DB_TITLE,
        filterValue: 'database',
      },
      timestamp: Date.now(),
    });
    let dbSearch;
    try {
      dbSearch = await notion.search({
        query: DAILY_NOTES_DB_TITLE,
        // Notion Search API now only accepts object filter values: "page" or "data_source".
        // Databases are returned as "data_source".
        filter: { property: 'object', value: 'data_source' } as any,
      });
    } catch (error) {
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H1',
        location: 'src/main/notion.ts:findExistingResources:dbSearch:error',
        message: 'daily notes search failed',
        data: {
          error: error instanceof Error ? error.message : String(error),
          code: (error as any).code,
        },
        timestamp: Date.now(),
      });
      throw error;
    }
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
        const dailyNotesDbId = item.id;
        result.dailyNotesDataSourceId = await resolvePrimaryDataSourceId(
          notion,
          dailyNotesDbId,
          'daily_notes',
        );
        break;
      }
    }

    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H5',
      location: 'src/main/notion.ts:findExistingResources:tasksSearch',
      message: 'searching for tasks database',
      data: {
        query: TASKS_DB_TITLE,
        filterValue: 'database',
      },
      timestamp: Date.now(),
    });
    let tasksSearch;
    try {
      tasksSearch = await notion.search({
        query: TASKS_DB_TITLE,
        // Notion Search API now only accepts object filter values: "page" or "data_source".
        // Databases are returned as "data_source".
        filter: { property: 'object', value: 'data_source' } as any,
      });
    } catch (error) {
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H1',
        location: 'src/main/notion.ts:findExistingResources:tasksSearch:error',
        message: 'tasks search failed',
        data: {
          error: error instanceof Error ? error.message : String(error),
          code: (error as any).code,
        },
        timestamp: Date.now(),
      });
      throw error;
    }
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
        const tasksDbId = item.id;
        result.tasksDataSourceId = await resolvePrimaryDataSourceId(
          notion,
          tasksDbId,
          'tasks',
        );
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
    const payload: any = {
      parent: { type: 'page_id', page_id: normalizeNotionId(flowStatePageId) },
      title: [{ text: { content: DAILY_NOTES_DB_TITLE } }],
      properties: properties as any,
    };
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H3',
      location: 'src/main/notion.ts:createDailyNotesDatabase:properties',
      message: 'daily notes properties built',
      data: {
        keys: Object.keys(payload.properties),
        keyCount: Object.keys(payload.properties).length,
        payloadKeys: Object.keys(payload),
        payloadHasProperties: payload.properties !== undefined,
      },
      timestamp: Date.now(),
    });
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H6',
      location: 'src/main/notion.ts:createDailyNotesDatabase:call',
      message: 'calling databases.create for daily notes',
      data: {
        parentPageId: normalizeNotionId(flowStatePageId),
        title: DAILY_NOTES_DB_TITLE,
        propertyKeys: Object.keys(payload.properties),
        fullPayload: JSON.stringify(payload),
      },
      timestamp: Date.now(),
    });
    const response = await notion.databases.create(payload);
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H6',
      location: 'src/main/notion.ts:createDailyNotesDatabase:success',
      message: 'successfully created daily notes database',
      data: {
        id: response.id,
      },
      timestamp: Date.now(),
    });
    return response.id;
  }

  async function createTasksDatabase(
    notion: Client,
    flowStatePageId: string,
  ): Promise<string> {
    const properties = ensureDatabaseProperties(buildTasksDbProperties());
    const payload: any = {
      parent: { type: 'page_id', page_id: normalizeNotionId(flowStatePageId) },
      title: [{ text: { content: TASKS_DB_TITLE } }],
      properties: properties as any,
    };
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H4',
      location: 'src/main/notion.ts:createTasksDatabase:properties',
      message: 'tasks properties built',
      data: {
        keys: Object.keys(payload.properties),
        keyCount: Object.keys(payload.properties).length,
        payloadKeys: Object.keys(payload),
        payloadHasProperties: payload.properties !== undefined,
      },
      timestamp: Date.now(),
    });
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H7',
      location: 'src/main/notion.ts:createTasksDatabase:call',
      message: 'calling databases.create for tasks',
      data: {
        parentPageId: normalizeNotionId(flowStatePageId),
        title: TASKS_DB_TITLE,
        propertyKeys: Object.keys(payload.properties),
        fullPayload: JSON.stringify(payload),
      },
      timestamp: Date.now(),
    });
    try {
      const response = await notion.databases.create(payload);
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H7',
        location: 'src/main/notion.ts:createTasksDatabase:success',
        message: 'successfully created tasks database',
        data: {
          id: response.id,
        },
        timestamp: Date.now(),
      });
      return response.id;
    } catch (error) {
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
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
      });
      throw error;
    }
  }

  async function addDatabaseProperties(
    notion: Client,
    dataSourceId: string,
    properties: NotionDatabaseProperties,
    label: 'daily_notes' | 'tasks',
  ): Promise<void> {
    // Remove the Name property since it's already created by databases.create
    const { Name, ...propsToAdd } = properties;

    if (Object.keys(propsToAdd).length === 0) {
      return;
    }

    try {
      const dataSources = getDataSourcesClient(notion);
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H12',
        location: 'src/main/notion.ts:addDatabaseProperties:call',
        message: 'adding properties after database creation',
        data: {
          label,
          dataSourceId,
          propertyKeys: Object.keys(propsToAdd),
          properties: propsToAdd,
        },
        timestamp: Date.now(),
      });
      const updateResponse = (await dataSources.update({
        data_source_id: dataSourceId,
        properties: propsToAdd,
      })) as { properties?: Record<string, { type?: string }> };

      // Verify the properties were added
      const responseProperties = (updateResponse.properties ?? {}) as Record<
        string,
        { type?: string }
      >;
      const addedKeys = Object.keys(responseProperties);

      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H12',
        location: 'src/main/notion.ts:addDatabaseProperties:success',
        message: 'successfully added properties',
        data: {
          label,
          requestedKeys: Object.keys(propsToAdd),
          responseKeys: addedKeys,
          totalProperties: addedKeys.length,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H12',
        location: 'src/main/notion.ts:addDatabaseProperties:error',
        message: 'failed to add properties',
        data: {
          label,
          error: error instanceof Error ? error.message : String(error),
          code: (error as any).code,
          stack: error instanceof Error ? error.stack : undefined,
        },
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  async function ensureDailyNotesRelation(
    notion: Client,
    dailyNotesDataSourceId: string,
    tasksDataSourceId: string,
  ): Promise<void> {
    const properties: any = {
      Tasks: {
        relation: {
          data_source_id: tasksDataSourceId,
          type: 'single_property',
          single_property: {},
        },
      },
    };
    try {
      const dataSources = getDataSourcesClient(notion);
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H8',
        location: 'src/main/notion.ts:ensureDailyNotesRelation:call',
        message: 'calling dataSources.update for daily notes relation',
        data: {
          dailyNotesDataSourceId,
          tasksDataSourceId,
          propertyKeys: Object.keys(properties),
          relationConfig: properties.Tasks.relation,
        },
        timestamp: Date.now(),
      });
      await dataSources.update({
        data_source_id: dailyNotesDataSourceId,
        properties,
      });
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H8',
        location: 'src/main/notion.ts:ensureDailyNotesRelation:success',
        message: 'successfully updated daily notes relation',
        timestamp: Date.now(),
      });
    } catch (error) {
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
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
      });
      throw error;
    }
  }

  function ensureDatabaseProperties(
    properties?: NotionDatabaseProperties,
  ): NotionDatabaseProperties {
    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
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
    });
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
      notionDailyNotesDataSourceId: ids.dailyNotesDataSourceId,
      notionTodosDataSourceId: ids.tasksDataSourceId,
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
        dailyNotesDataSourceId: ids.dailyNotesDataSourceId,
        todosDataSourceId: ids.tasksDataSourceId,
      },
      onboardingState: {
        ...updatedOnboarding,
        notion: {
          ...updatedOnboarding.notion,
          status: 'ready',
          parentPageId,
          flowStatePageId: ids.flowStatePageId,
          dailyNotesDataSourceId: ids.dailyNotesDataSourceId,
          tasksDataSourceId: ids.tasksDataSourceId,
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
    if (error.code === APIErrorCode.RestrictedResource) {
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

/**
 * Validate Notion database schemas on app startup.
 */
export async function checkNotionSchemasOnStartup(): Promise<void> {
  const logger = getLogger();
  try {
    const tokensStore = getTokensStore();
    const configStore = getConfigStore();
    const [tokens, config] = await Promise.all([
      tokensStore.read(),
      configStore.read(),
    ]);
    const onboardingState = config.onboardingState;
    const accessToken = tokens.notionAccessToken;
    const dailyNotesDataSourceId =
      tokens.notionDailyNotesDataSourceId ??
      onboardingState?.notion.dailyNotesDataSourceId ??
      '';
    const tasksDataSourceId =
      tokens.notionTodosDataSourceId ??
      onboardingState?.notion.tasksDataSourceId ??
      '';

    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:checkNotionSchemasOnStartup:entry',
      message: 'checking notion schemas on startup',
      data: {
        hasAccessToken: !!accessToken,
        hasDailyNotesDataSourceId: !!dailyNotesDataSourceId,
        hasTasksDataSourceId: !!tasksDataSourceId,
        notionStatus: onboardingState?.notion.status,
      },
      timestamp: Date.now(),
    });

    if (!accessToken || !dailyNotesDataSourceId || !tasksDataSourceId) {
      // DEBUG: notion-onboarding
      logger.debug('notion-onboarding', {
        sessionId: 'debug-session',
        runId: 'pre',
        hypothesisId: 'H12',
        location: 'src/main/notion.ts:checkNotionSchemasOnStartup:skip',
        message: 'skipping schema check due to missing data',
        data: {
          hasAccessToken: !!accessToken,
          hasDailyNotesDataSourceId: !!dailyNotesDataSourceId,
          hasTasksDataSourceId: !!tasksDataSourceId,
        },
        timestamp: Date.now(),
      });
      return;
    }

    const notion = new Client({ auth: accessToken });
    const expectedProperties = buildExpectedProperties(
      dailyNotesDataSourceId,
      tasksDataSourceId,
    );
    const expectedTypes = buildExpectedPropertyTypes(
      dailyNotesDataSourceId,
      tasksDataSourceId,
    );
    const dailySchema = await fetchDataSourceSchemaEntries(
      notion,
      dailyNotesDataSourceId,
      'daily_notes',
    );
    const tasksSchema = await fetchDataSourceSchemaEntries(
      notion,
      tasksDataSourceId,
      'tasks',
    );

    const dailyDiff = diffPropertyTypes(expectedTypes.daily, dailySchema);
    const tasksDiff = diffPropertyTypes(expectedTypes.tasks, tasksSchema);

    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion.ts:checkNotionSchemasOnStartup:diff',
      message: 'data source schema diff',
      data: {
        daily: dailyDiff,
        tasks: tasksDiff,
      },
      timestamp: Date.now(),
    });

    if (
      dailyDiff.missing.length > 0 ||
      tasksDiff.missing.length > 0 ||
      dailyDiff.typeMismatches.length > 0 ||
      tasksDiff.typeMismatches.length > 0
    ) {
      await ensureDataSourcePropertiesOnStartup(
        notion,
        dailyNotesDataSourceId,
        'daily_notes',
        expectedProperties.daily,
        dailySchema,
      );
      await ensureDataSourcePropertiesOnStartup(
        notion,
        tasksDataSourceId,
        'tasks',
        expectedProperties.tasks,
        tasksSchema,
      );
    }
  } catch (error) {
    logger.error('Failed to check Notion schemas on startup', { error });
  }
}
