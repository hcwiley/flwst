/**
 * Notion schema validation and migration detection.
 * Validates database schemas on startup and detects property migrations.
 */

import { Client } from '@notionhq/client';
import { getLogger } from '../sentry';
import { getConfigStore, getTokensStore } from '../storage';
import {
  buildDailyNotesDbProperties,
  buildTasksDbProperties,
} from './notionSchema';
import type { NotionDatabaseProperties } from './notionTypes';
import {
  fetchDataSourceSchemaEntries,
  ensureDataSourcePropertiesOnStartup,
} from './dataSources';
import { emitOnboardingStateChanged } from './onboardingEvents';
import type { NotionPropertyEntry } from './dataSources';

const logger = getLogger();

type NotionPropertyTypes = Record<string, string>;

/**
 * Get property type from a Notion property value.
 */
function getPropertyType(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return 'unknown';
  }
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0 ? keys[0] : 'unknown';
}

/**
 * Build expected property types for both databases.
 */
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

/**
 * Build expected properties for both databases.
 */
function buildExpectedProperties(
  dailyNotesDataSourceId: string,
  tasksDataSourceId: string,
): { daily: NotionDatabaseProperties; tasks: NotionDatabaseProperties } {
  return {
    daily: buildDailyNotesDbProperties(tasksDataSourceId),
    tasks: buildTasksDbProperties(dailyNotesDataSourceId),
  };
}

/**
 * Diff expected and actual property types.
 * Returns missing properties, type mismatches, and extra properties.
 */
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

/**
 * Detect if the Status property has been migrated from select to status type.
 * The migration is needed if the "Status" property (exact name) is still type "select".
 * The migration is complete when "Status" property is type "status" (or doesn't exist and a status-type property exists).
 */
export function detectStatusPropertyMigration(
  schema: NotionPropertyEntry[],
): {
  needsMigration: boolean;
  hasBeenMigrated: boolean;
} {
  const statusProperty = schema.find((entry) => entry.key === 'Status');
  const hasStatusTypeProperty = schema.some((entry) => entry.type === 'status');

  // Needs migration if Status property exists and is type select
  const needsMigration = statusProperty?.type === 'select';

  // Migration is complete if Status property is type status, OR
  // if Status doesn't exist but a status-type property exists (user may have renamed it)
  const hasBeenMigrated =
    statusProperty?.type === 'status' ||
    (!statusProperty && hasStatusTypeProperty);

  return {
    needsMigration,
    hasBeenMigrated,
  };
}

/**
 * Validate Notion database schemas on app startup.
 */
export async function checkNotionSchemasOnStartup(): Promise<void> {
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
      location: 'src/main/notion/schemaValidation.ts:checkNotionSchemasOnStartup:entry',
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
        location: 'src/main/notion/schemaValidation.ts:checkNotionSchemasOnStartup:skip',
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
      location: 'src/main/notion/schemaValidation.ts:checkNotionSchemasOnStartup:diff',
      message: 'data source schema diff',
      data: {
        daily: dailyDiff,
        tasks: tasksDiff,
      },
      timestamp: Date.now(),
    });

    // Detect Status property migration
    const tasksMigrationStatus = detectStatusPropertyMigration(tasksSchema);

    // DEBUG: notion-onboarding
    logger.debug('notion-onboarding', {
      sessionId: 'debug-session',
      runId: 'pre',
      hypothesisId: 'H12',
      location: 'src/main/notion/schemaValidation.ts:checkNotionSchemasOnStartup:migration',
      message: 'status property migration detection',
      data: {
        needsMigration: tasksMigrationStatus.needsMigration,
        hasBeenMigrated: tasksMigrationStatus.hasBeenMigrated,
        currentFlag: onboardingState?.notion.statusPropertyMigrated,
      },
      timestamp: Date.now(),
    });

    // Persist detected migration status for renderer gating.
    if (
      onboardingState &&
      (onboardingState.notion.statusPropertyNeedsMigration !==
        tasksMigrationStatus.needsMigration ||
        onboardingState.notion.statusPropertyHasBeenMigrated !==
          tasksMigrationStatus.hasBeenMigrated)
    ) {
      await configStore.write({
        ...config,
        onboardingState: {
          ...onboardingState,
          onboardingCompleted: onboardingState.onboardingCompleted,
          notion: {
            ...onboardingState.notion,
            statusPropertyNeedsMigration: tasksMigrationStatus.needsMigration,
            statusPropertyHasBeenMigrated: tasksMigrationStatus.hasBeenMigrated,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      // Notify renderer that onboarding state changed
      emitOnboardingStateChanged();
    }

    // Auto-update flag if user has already migrated in Notion UI
    // Only auto-update if onboarding is complete (user has seen the screen before)
    if (
      onboardingState &&
      onboardingState.onboardingCompleted &&
      tasksMigrationStatus.hasBeenMigrated &&
      !onboardingState.notion.statusPropertyMigrated
    ) {
      logger.info('Status property migration detected, updating state', {
        dataSourceId: tasksDataSourceId,
      });

      await configStore.write({
        ...config,
        onboardingState: {
          ...onboardingState,
          onboardingCompleted: onboardingState.onboardingCompleted,
          notion: {
            ...onboardingState.notion,
            statusPropertyMigrated: true,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      // Notify renderer that onboarding state changed
      emitOnboardingStateChanged();
    }

    // Reset flag if migration is still needed (handles case where flag was incorrectly set)
    if (
      onboardingState &&
      tasksMigrationStatus.needsMigration &&
      onboardingState.notion.statusPropertyMigrated
    ) {
      logger.info(
        'Status property migration flag was set but migration still needed, resetting flag',
        {
          dataSourceId: tasksDataSourceId,
        },
      );

      await configStore.write({
        ...config,
        onboardingState: {
          ...onboardingState,
          onboardingCompleted: onboardingState.onboardingCompleted,
          notion: {
            ...onboardingState.notion,
            statusPropertyMigrated: false,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      // Notify renderer that onboarding state changed
      emitOnboardingStateChanged();
    }

    // Log if migration is recommended
    if (
      tasksMigrationStatus.needsMigration &&
      !onboardingState?.notion.statusPropertyMigrated
    ) {
      logger.info('Status property migration recommended', {
        dataSourceId: tasksDataSourceId,
      });
    }

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
