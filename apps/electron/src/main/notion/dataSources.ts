/**
 * Notion data source client access and property management.
 * Handles data source retrieval, schema fetching, and property updates.
 */

import { Client } from '@notionhq/client';
import { getLogger } from '../sentry';
import { normalizeNotionId } from './notionSchema';
import type { NotionDatabaseProperties } from './notionTypes';
import { NotionError } from './errors';

const logger = getLogger();

export type NotionPropertyEntry = {
  key: string;
  type: string;
};

/**
 * Get the dataSources client from Notion SDK.
 * Throws if dataSources client is not available.
 */
export function getDataSourcesClient(notion: Client): {
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
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      'Notion SDK dataSources client missing. Update dependency/build.',
    );
  }
  return dataSources;
}

/**
 * Resolve the primary data source ID from a database ID.
 * Notion databases can have multiple data sources; we use the first one.
 */
export async function resolvePrimaryDataSourceId(
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
  if (!dataSourceId) {
    throw new NotionError(
      'NOTION_VALIDATION_ERROR',
      'Notion database missing data_sources; only data source schema supported.',
    );
  }
  return dataSourceId;
}

/**
 * Fetch data source schema entries (property names and types).
 * Returns empty array on error (non-throwing).
 */
export async function fetchDataSourceSchemaEntries(
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
    return entries;
  } catch (error) {
    logger.error('Failed to fetch data source schema entries', { error });
    return [];
  }
}

/**
 * Fetch full data source schema with property configurations.
 * Returns the full properties object for detailed comparison.
 */
export async function fetchDataSourceFullSchema(
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
    return {};
  }
}

/**
 * Check if select/multi-select options need to be updated.
 * Returns properties that need option updates.
 */
export function findPropertiesNeedingOptionUpdates(
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

/**
 * Pick properties that are missing from the actual schema.
 */
export function pickMissingProperties(
  expected: NotionDatabaseProperties,
  actual: NotionPropertyEntry[],
): NotionDatabaseProperties {
  const actualKeys = new Set(actual.map((entry) => entry.key));
  return Object.fromEntries(
    Object.entries(expected).filter(([key]) => !actualKeys.has(key)),
  ) as NotionDatabaseProperties;
}

/**
 * Ensure data source properties match expected schema on startup.
 * Adds missing properties and updates select/multi-select options.
 */
export async function ensureDataSourcePropertiesOnStartup(
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
    logger.debug('Relation properties before sending', { relationProps });

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

    await fetchDataSourceSchemaEntries(notion, dataSourceId, label);
  } catch (error) {
    logger.error('Failed to ensure data source properties on startup', { error });
  }
}
