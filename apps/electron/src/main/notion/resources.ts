/**
 * Notion resource creation, verification, and persistence.
 * Handles creating pages, databases, and managing resource IDs.
 */

import { Client } from '@notionhq/client';
import type { OnboardingState } from '@flwst/types';
import { getLogger } from '../sentry';
import { getConfigStore, getTokensStore } from '../storage';
import {
  buildDailyNotesDbProperties,
  buildTasksDbProperties,
  normalizeNotionId,
} from './notionSchema';
import type { NotionDatabaseProperties } from './notionTypes';
import {
  FLOW_STATE_PAGE_TITLE,
  DAILY_NOTES_DB_TITLE,
  TASKS_DB_TITLE,
  type CreateResourcesResult,
} from './constants';
import {
  getDataSourcesClient,
  resolvePrimaryDataSourceId,
} from './dataSources';
import { NotionError } from './errors';
import { emitOnboardingStateChanged } from './onboardingEvents';

const logger = getLogger();

/**
 * In-flight resource creation promises, keyed by workspaceId:parentPageId.
 */
const createResourcesInFlight = new Map<
  string,
  Promise<CreateResourcesResult>
>();

/**
 * Resolve stored resource IDs from tokens and onboarding state.
 */
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

/**
 * Verify that resources exist and are accessible.
 */
export async function verifyResources(
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

/**
 * Log database schema by data source ID (for debugging).
 */
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
    logger.debug('Database schema by data source ID', {
      dataSourceId,
      label,
      entries,
    });
  } catch (error) {
    logger.error('Failed to log database schema by data source ID', { error });
  }
}

/**
 * Find existing Notion resources by searching for pages and databases.
 */
export async function findExistingResources(
  notion: Client,
  parentPageId: string,
): Promise<Partial<CreateResourcesResult>> {
  const result: Partial<CreateResourcesResult> = {};

  const pageSearch = await notion.search({
    query: FLOW_STATE_PAGE_TITLE,
    filter: {
      property: 'object',
      value: 'page',
    } as { property: string; value: string },
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

  let dbSearch;
  try {
    dbSearch = await notion.search({
      query: DAILY_NOTES_DB_TITLE,
      // Notion Search API now only accepts object filter values: "page" or "data_source".
      filter: {
        property: 'object',
        value: 'data_source',
      } as { property: string; value: string },
    });
  } catch (error) {
    logger.error('Failed to search for daily notes database', { error });
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

  let tasksSearch;
  try {
    tasksSearch = await notion.search({
      query: TASKS_DB_TITLE,
      // Notion Search API now only accepts object filter values: "page" or "data_source".
      filter: {
        property: 'object',
        value: 'data_source',
      } as { property: string; value: string },
    });
  } catch (error) {
    logger.error('Failed to search for tasks database', { error });
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

/**
 * Generic wrapper for creating a Notion page.
 * Provides parent page_id and title.
 */
async function createNotionPage(
  notion: Client,
  parentPageId: string,
  title: string,
): Promise<string> {
  const response = await notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
    },
  });
  return response.id;
}

/**
 * Generic wrapper for creating a Notion database.
 * Provides parent page_id, title, and properties.
 */
async function createNotionDatabase(
  notion: Client,
  parentPageId: string,
  title: string,
  properties: NotionDatabaseProperties,
): Promise<string> {
  const payload: {
    parent: { type: 'page_id'; page_id: string };
    title: Array<{ text: { content: string } }>;
    properties: Record<string, unknown>;
  } = {
    parent: { type: 'page_id', page_id: normalizeNotionId(parentPageId) },
    title: [{ text: { content: title } }],
    properties: properties as Record<string, unknown>,
  };
  const response = await notion.databases.create(payload);
  return response.id;
}

/**
 * Ensure database properties object has at least a Name property.
 */
function ensureDatabaseProperties(
  properties?: NotionDatabaseProperties,
): NotionDatabaseProperties {
  if (properties && Object.keys(properties).length > 0) {
    return properties;
  }
  return {
    Name: { title: {} },
  };
}

/**
 * Create the flow state page.
 */
export async function createFlowStatePage(
  notion: Client,
  parentPageId: string,
): Promise<string> {
  return createNotionPage(notion, parentPageId, FLOW_STATE_PAGE_TITLE);
}

/**
 * Create the Daily Notes database.
 */
export async function createDailyNotesDatabase(
  notion: Client,
  flowStatePageId: string,
): Promise<string> {
  const properties = ensureDatabaseProperties(buildDailyNotesDbProperties());
  try {
    return createNotionDatabase(
      notion,
      flowStatePageId,
      DAILY_NOTES_DB_TITLE,
      properties,
    );
  } catch (error) {
    logger.error('Failed to create daily notes database', { error });
    throw error;
  }
}

/**
 * Create the Tasks database.
 */
export async function createTasksDatabase(
  notion: Client,
  flowStatePageId: string,
): Promise<string> {
  const properties = ensureDatabaseProperties(buildTasksDbProperties());
  try {
    return createNotionDatabase(
      notion,
      flowStatePageId,
      TASKS_DB_TITLE,
      properties,
    );
  } catch (error) {
    logger.error('Failed to create tasks database', { error });
    throw error;
  }
}

/**
 * Add database properties after database creation.
 * Removes the Name property since it's already created.
 */
export async function addDatabaseProperties(
  notion: Client,
  dataSourceId: string,
  properties: NotionDatabaseProperties,
  _label: 'daily_notes' | 'tasks',
): Promise<void> {
  // Remove the Name property since it's already created by databases.create
  const { Name: _name, ...propsToAdd } = properties;

  if (Object.keys(propsToAdd).length === 0) {
    return;
  }

  try {
    const dataSources = getDataSourcesClient(notion);
    await dataSources.update({
      data_source_id: dataSourceId,
      properties: propsToAdd,
    });
  } catch (error) {
    logger.error('Failed to add database properties', { error });
    throw error;
  }
}

/**
 * Ensure Daily Notes has a relation to Tasks database.
 */
export async function ensureDailyNotesRelation(
  notion: Client,
  dailyNotesDataSourceId: string,
  tasksDataSourceId: string,
): Promise<void> {
  const properties: Record<
    string,
    {
      relation: {
        data_source_id: string;
        type: 'single_property';
        single_property: Record<string, never>;
      };
    }
  > = {
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
    await dataSources.update({
      data_source_id: dailyNotesDataSourceId,
      properties,
    });
  } catch (error) {
    logger.error('Failed to ensure daily notes relation', { error });
    throw error;
  }
}

/**
 * Persist resource IDs to storage and update onboarding state.
 */
export async function persistIds(
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
        status: 'resources_created',
        parentPageId,
        flowStatePageId: ids.flowStatePageId,
        dailyNotesDataSourceId: ids.dailyNotesDataSourceId,
        tasksDataSourceId: ids.tasksDataSourceId,
        statusPropertyMigrated: false,
        statusPropertyNeedsMigration: true,
        statusPropertyHasBeenMigrated: false,
        updatedAt: now,
        createdAt: updatedOnboarding.notion.createdAt ?? now,
      },
    },
  });
  // Notify renderer that onboarding state changed (migration flags set)
  emitOnboardingStateChanged();
}

/**
 * Create Notion resources (internal implementation).
 * Handles deduplication via in-flight map and verifies resources exist.
 */
export async function createResourcesInternal(
  parentPageId: string,
  onboardingState?: OnboardingState,
): Promise<CreateResourcesResult> {
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
  });

  logger.info('Creating Notion resources', { parentPageId });

  const stored = resolveStoredIds(tokens, onboardingState);
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

/**
 * Get or create resources with deduplication.
 * Uses in-flight map to prevent duplicate concurrent creation.
 */
export async function getOrCreateResources(
  parentPageId: string,
  onboardingState?: OnboardingState,
): Promise<CreateResourcesResult> {
  const workspaceId =
    onboardingState?.notion.workspace?.workspaceId ?? 'unknown';
  const inFlightKey = `${workspaceId}:${normalizeNotionId(parentPageId)}`;
  const inFlight = createResourcesInFlight.get(inFlightKey);
  if (inFlight) {
    return await inFlight;
  }

  const promise = createResourcesInternal(parentPageId, onboardingState);
  createResourcesInFlight.set(inFlightKey, promise);
  try {
    return await promise;
  } finally {
    createResourcesInFlight.delete(inFlightKey);
  }
}
