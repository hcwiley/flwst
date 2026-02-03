import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

const r = (...parts: string[]) => resolve(__dirname, ...parts);

export default defineConfig({
  main: {
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
      // Excluding this workspace package forces it to be bundled instead of `require('@flwst/core')`.
      externalizeDeps: {
        exclude: ['@flwst/core', '@flwst/types', '@flwst/prompts'],
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
        exclude: ['@flwst/core', '@flwst/types', '@flwst/prompts'],
      },
    },
  },

  renderer: {
    resolve: {
      alias: {
        '@renderer': r('src/renderer/src'),
        // Use source files in dev, not dist
        '@flwst/ui': r('../../libs/ui/src'),
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
      'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL || 'info'),
    },
    optimizeDeps: {
      // Exclude Sentry from dependency optimization (dynamic imports)
      exclude: ['@sentry/electron/renderer'],
      // Include Tamagui packages for optimization
      include: ['tamagui', '@tamagui/config'],
    },
  },
});
