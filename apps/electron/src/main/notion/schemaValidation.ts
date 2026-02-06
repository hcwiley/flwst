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
 * Ignore Status type mismatches between select and status.
 * Status must be migrated manually in Notion UI; we do not auto-update types.
 */
function filterStatusTypeMismatch(
  mismatches: { key: string; expected: string; actual: string }[],
): { key: string; expected: string; actual: string }[] {
  return mismatches.filter((entry) => {
    if (entry.key !== 'Status') return true;
    const expected = entry.expected.toLowerCase();
    const actual = entry.actual.toLowerCase();
    return !(
      (expected === 'status' && actual === 'select') ||
      (expected === 'select' && actual === 'status')
    );
  });
}

/**
 * Detect if the Status property has been migrated from select to status type.
 * The migration is needed if the "Status" property (exact name) is still type "select".
 * The migration is complete when "Status" property is type "status" (or doesn't exist and a status-type property exists).
 */
export function detectStatusPropertyMigration(schema: NotionPropertyEntry[]): {
  needsMigration: boolean;
  hasBeenMigrated: boolean;
} {
  const statusProperty = schema.find((entry) => entry.key === 'Status');
  const hasStatusTypeProperty = schema.some((entry) => entry.type === 'status');

  // Needs migration if Status property exists and is type select
  const needsMigration = statusProperty?.type === 'select';

  // Migration is complete if Status property is type status, OR
  // if any status-type property exists (user may have renamed it)
  const hasBeenMigrated =
    statusProperty?.type === 'status' || hasStatusTypeProperty;

  return {
    needsMigration,
    hasBeenMigrated,
  };
}

/**
 * Check if a schema fetch was successful.
 * Empty schemas likely indicate a fetch failure rather than a database with no properties.
 */
function isSchemaValid(schema: NotionPropertyEntry[]): boolean {
  // A valid schema should have at least one property (typically "Name")
  // Empty schemas likely indicate fetch failures
  return schema.length > 0;
}

/**
 * Persist detected migration status for renderer gating.
 */
async function persistMigrationStatus(
  configStore: ReturnType<typeof getConfigStore>,
  config: Awaited<ReturnType<ReturnType<typeof getConfigStore>['read']>>,
  onboardingState: NonNullable<
    Awaited<
      ReturnType<ReturnType<typeof getConfigStore>['read']>
    >['onboardingState']
  >,
  migrationStatus: { needsMigration: boolean; hasBeenMigrated: boolean },
): Promise<void> {
  if (
    onboardingState.notion.statusPropertyNeedsMigration ===
      migrationStatus.needsMigration &&
    onboardingState.notion.statusPropertyHasBeenMigrated ===
      migrationStatus.hasBeenMigrated
  ) {
    return; // No change needed
  }

  await configStore.write({
    ...config,
    onboardingState: {
      ...onboardingState,
      onboardingCompleted: onboardingState.onboardingCompleted,
      notion: {
        ...onboardingState.notion,
        statusPropertyNeedsMigration: migrationStatus.needsMigration,
        statusPropertyHasBeenMigrated: migrationStatus.hasBeenMigrated,
        updatedAt: new Date().toISOString(),
      },
    },
  });
  emitOnboardingStateChanged();
}

/**
 * Auto-update flag if user has already migrated in Notion UI.
 * Only auto-update if onboarding is complete (user has seen the screen before).
 */
async function markMigrationComplete(
  configStore: ReturnType<typeof getConfigStore>,
  config: Awaited<ReturnType<ReturnType<typeof getConfigStore>['read']>>,
  onboardingState: NonNullable<
    Awaited<
      ReturnType<ReturnType<typeof getConfigStore>['read']>
    >['onboardingState']
  >,
  tasksDataSourceId: string,
): Promise<void> {
  if (
    !onboardingState.onboardingCompleted ||
    onboardingState.notion.statusPropertyMigrated
  ) {
    return; // Not applicable
  }

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
  emitOnboardingStateChanged();
}

/**
 * Reset flag if migration is still needed (handles case where flag was incorrectly set).
 */
async function resetMigrationFlag(
  configStore: ReturnType<typeof getConfigStore>,
  config: Awaited<ReturnType<ReturnType<typeof getConfigStore>['read']>>,
  onboardingState: NonNullable<
    Awaited<
      ReturnType<ReturnType<typeof getConfigStore>['read']>
    >['onboardingState']
  >,
  tasksDataSourceId: string,
): Promise<void> {
  if (!onboardingState.notion.statusPropertyMigrated) {
    return; // Flag not set, nothing to reset
  }

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
  emitOnboardingStateChanged();
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

    if (!accessToken || !dailyNotesDataSourceId || !tasksDataSourceId) {
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

    // Guard: Skip migration status updates if schema fetch failed (empty schemas)
    // Empty schemas likely indicate fetch failures rather than databases with no properties
    const isTasksSchemaValid = isSchemaValid(tasksSchema);

    if (isTasksSchemaValid && onboardingState) {
      // Detect Status property migration
      const tasksMigrationStatus = detectStatusPropertyMigration(tasksSchema);

      // Persist detected migration status for renderer gating.
      await persistMigrationStatus(
        configStore,
        config,
        onboardingState,
        tasksMigrationStatus,
      );

      // Auto-update flag if user has already migrated in Notion UI
      if (tasksMigrationStatus.hasBeenMigrated) {
        await markMigrationComplete(
          configStore,
          config,
          onboardingState,
          tasksDataSourceId,
        );
      }

      // Reset flag if migration is still needed
      if (tasksMigrationStatus.needsMigration) {
        await resetMigrationFlag(
          configStore,
          config,
          onboardingState,
          tasksDataSourceId,
        );
      }

      // Log if migration is recommended
      if (
        tasksMigrationStatus.needsMigration &&
        !onboardingState.notion.statusPropertyMigrated
      ) {
        logger.info('Status property migration recommended', {
          dataSourceId: tasksDataSourceId,
        });
      }
    } else if (!isTasksSchemaValid) {
      logger.warn(
        'Skipping migration status checks: tasks schema fetch may have failed',
        {
          tasksDataSourceId,
          schemaLength: tasksSchema.length,
        },
      );
    }

    const dailyDiff = diffPropertyTypes(expectedTypes.daily, dailySchema);
    const rawTasksDiff = diffPropertyTypes(expectedTypes.tasks, tasksSchema);
    const tasksDiff = {
      ...rawTasksDiff,
      typeMismatches: filterStatusTypeMismatch(rawTasksDiff.typeMismatches),
    };

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
