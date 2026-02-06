/**
 * Notion schema type helpers used by the main process.
 *
 * Keeps database property typing centralized for schema builders and
 * database-creation payloads, so we avoid relying on SDK internal types.
 */

type NotionEmptyObject = Record<string, never>;

type NotionSelectOption = {
  name: string;
  color?: string;
};

type NotionRelationConfig = {
  data_source_id: string;
  type?: 'single_property' | 'dual_property';
  single_property?: NotionEmptyObject;
  dual_property?: NotionEmptyObject;
};

export type NotionDatabaseProperty =
  | { title: NotionEmptyObject }
  | { rich_text: NotionEmptyObject }
  | { date: NotionEmptyObject }
  | { multi_select: { options: NotionSelectOption[] } }
  | { select: { options: NotionSelectOption[] } }
  | { status: NotionEmptyObject }
  | { unique_id: { prefix?: string } }
  | { relation: NotionRelationConfig };

export type NotionDatabaseProperties = Record<string, NotionDatabaseProperty>;
