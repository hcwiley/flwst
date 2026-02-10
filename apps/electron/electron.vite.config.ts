import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

const r = (...parts: string[]): string => resolve(__dirname, ...parts);

export default defineConfig(({ mode }) => {
  // Load monorepo root .env so FLWST_API_URL etc. are available to main process
  const rootEnv = loadEnv(mode, r('../../'), '');
  const flwstApiUrl = rootEnv.FLWST_API_URL ?? process.env.FLWST_API_URL ?? '';
  const reuseLlmOutput =
    rootEnv.FLWST_REUSE_LLM_OUTPUT ?? process.env.FLWST_REUSE_LLM_OUTPUT ?? '';
  const amplitudeApiKey =
    rootEnv.AMPLITUDE_API_KEY ?? process.env.AMPLITUDE_API_KEY ?? '';

  // Notion OAuth configuration (required for packaged app)
  const notionClientId =
    rootEnv.NOTION_CLIENT_ID ?? process.env.NOTION_CLIENT_ID ?? '';
  const notionClientSecret =
    rootEnv.NOTION_CLIENT_SECRET ?? process.env.NOTION_CLIENT_SECRET ?? '';
  const notionRedirectUri =
    rootEnv.NOTION_REDIRECT_URI ?? process.env.NOTION_REDIRECT_URI ?? '';

  return {
    main: {
      define: {
        'process.env.FLWST_API_URL': JSON.stringify(flwstApiUrl),
        'process.env.FLWST_REUSE_LLM_OUTPUT': JSON.stringify(reuseLlmOutput),
        'process.env.NOTION_CLIENT_ID': JSON.stringify(notionClientId),
        'process.env.NOTION_CLIENT_SECRET': JSON.stringify(notionClientSecret),
        'process.env.NOTION_REDIRECT_URI': JSON.stringify(notionRedirectUri),
      },
      resolve: {
        alias: {
          // Use source files in dev, not dist
          '@flwst/core': r('../../libs/core/src/index.ts'),
          '@flwst/core/logger': r('../../libs/core/src/logger.ts'),
          '@flwst/prompts': r('../../libs/prompts/src/index.ts'),
          '@flwst/types': r('../../types/src/index.ts'),
        },
      },
      ssr: {
        // Keep workspace package bundled for SSR builds
        noExternal: ['@flwst/core', '@flwst/types', '@flwst/prompts'],
      },
      build: {
        // electron-vite externalizes deps in main/preload by default.
        // Excluding these forces them to be bundled so the packaged app needs only keytar in node_modules.
        externalizeDeps: {
          exclude: [
            '@flwst/core',
            '@flwst/types',
            '@flwst/prompts',
            '@electron-toolkit/utils',
            '@notionhq/client',
            '@sentry/electron',
          ],
        },
      },
    },

    preload: {
      resolve: {
        alias: {
          // Use source files in dev, not dist
          '@flwst/core': r('../../libs/core/src/index.ts'),
          '@flwst/core/logger': r('../../libs/core/src/logger.ts'),
          '@flwst/prompts': r('../../libs/prompts/src/index.ts'),
          '@flwst/types': r('../../types/src/index.ts'),
        },
      },
      ssr: {
        // Keep workspace package bundled for SSR builds
        noExternal: ['@flwst/core', '@flwst/types', '@flwst/prompts'],
      },
      build: {
        externalizeDeps: {
          exclude: [
            '@flwst/core',
            '@flwst/types',
            '@flwst/prompts',
            '@electron-toolkit/preload',
          ],
        },
      },
    },

    renderer: {
      resolve: {
        alias: {
          '@renderer': r('src/renderer/src'),
          // Use source files in dev, not dist
          '@flwst/ui': r('../../libs/ui/src'),
          // Use browser-safe integrations (excludes Sentry; avoids @sentry/electron/main in renderer)
          '@flwst/integrations': r(
            '../../libs/integrations/src/index.browser.ts',
          ),
          // Alias for subpath imports (e.g., @flwst/core/logger)
          '@flwst/core/logger': r('../../libs/core/src/logger.ts'),
          // Use browser-safe exports for renderer (excludes Node.js modules like paths)
          '@flwst/core': r('../../libs/core/src/index.browser.ts'),
          '@flwst/types': r('../../types/src/index.ts'),
        },
      },
      plugins: [react()],
      define: {
        // Make process.env available in renderer for compatibility
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV || 'development',
        ),
        'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || ''),
        'process.env.SENTRY_LOGS_ENABLED': JSON.stringify(
          process.env.SENTRY_LOGS_ENABLED || '',
        ),
        'process.env.LOG_LEVEL': JSON.stringify(
          process.env.LOG_LEVEL || 'info',
        ),
        'process.env.FLWST_API_URL': JSON.stringify(flwstApiUrl),
        'process.env.FLWST_REUSE_LLM_OUTPUT': JSON.stringify(reuseLlmOutput),
        'process.env.AMPLITUDE_API_KEY': JSON.stringify(amplitudeApiKey),
      },
      optimizeDeps: {
        // Exclude Sentry from dependency optimization (dynamic imports)
        exclude: ['@sentry/electron/renderer'],
        // Include Tamagui packages for optimization
        include: ['tamagui', '@tamagui/config'],
      },
    },
  };
});
