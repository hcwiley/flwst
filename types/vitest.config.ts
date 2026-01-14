/**
 * Vitest config for shared schema tests.
 *
 * Keeps tests isolated to the types package and ensures node execution.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
