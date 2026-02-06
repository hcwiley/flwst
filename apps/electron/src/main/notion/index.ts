/**
 * Notion module public API.
 * Re-exports public functions to maintain the same import path.
 */

export { registerNotionHandlers } from './handlers';
export { checkNotionSchemasOnStartup } from './schemaValidation';
export { runBootstrapSync } from './bootstrap';
