import './assets/main.css';

import { initAmplitude } from '@flwst/integrations';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initSentryRenderer, getLogger } from '../sentry';
import App from './App';

// Get version from build-time env
const appVersion = {
  version: process.env.APP_VERSION || '0.0.0',
  gitSha: process.env.APP_GIT_SHA || 'unknown',
  buildTime: process.env.APP_BUILD_TIME || '',
  formatted: process.env.APP_VERSION_FORMATTED || 'Unknown version',
};

// Initialize Sentry as early as possible in renderer process
// process.env is now defined via Vite config for compatibility
initSentryRenderer(
  process.env.SENTRY_DSN,
  process.env.NODE_ENV || 'development',
  appVersion.formatted,
);

// Amplitude: init when API key is set (no-op otherwise)
initAmplitude({
  apiKey: process.env.AMPLITUDE_API_KEY ?? '',
  appVersion: appVersion.formatted,
});

// Error boundary for renderer
window.addEventListener('error', (event) => {
  getLogger().error('Renderer error', { error: event.error });
});

window.addEventListener('unhandledrejection', (event) => {
  getLogger().error('Unhandled promise rejection', { reason: event.reason });
});

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  getLogger().error('Failed to render app', { error });
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: monospace;">
      <h1>Error Loading App</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
      <pre>${error instanceof Error ? error.stack : ''}</pre>
    </div>
  `;
}
