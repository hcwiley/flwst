import './assets/main.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { logger } from '@flwst/core';
import { initSentryRenderer, getLogger } from '../sentry';
import App from './App';

// Initialize Sentry as early as possible in renderer process
// process.env is now defined via Vite config for compatibility
initSentryRenderer(
  process.env.SENTRY_DSN,
  process.env.NODE_ENV || 'development',
);

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
