/**
 * Safe external link opener for renderer usage.
 *
 * Prefers the Electron shell when available, with a browser fallback.
 */
export function openExternal(url?: string): void {
  if (!url) return;
  try {
    const openFn = globalThis?.shell?.openExternal;
    if (typeof openFn === 'function') {
      void openFn(url);
      return;
    }
  } catch (error) {
    console.warn('Failed to open external link:', error);
  }
  if (typeof globalThis?.open === 'function') {
    globalThis.open(url, '_blank', 'noopener,noreferrer');
  }
}
