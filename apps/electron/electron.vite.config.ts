import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    // Optimize dependencies for main process
    build: {
      rollupOptions: {
        external: ['@sentry/electron/main'],
      },
    },
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        // Use source files in dev, not dist
        '@flwst/ui': resolve('../../libs/ui/src'),
      },
    },
    plugins: [react()],
    define: {
      // Make process.env available in renderer for compatibility
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'development',
      ),
      'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN || ''),
    },
    optimizeDeps: {
      // Exclude Sentry from dependency optimization (dynamic imports)
      exclude: ['@sentry/electron/renderer'],
      // Include Tamagui packages for optimization
      include: ['tamagui', '@tamagui/config'],
    },
  },
});
