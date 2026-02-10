/**
 * Preflight permissions check.
 * Manages the pre-storage-init flow where we explain to users why we need
 * certain permissions (Keychain, Microphone, etc.) before triggering OS prompts.
 *
 * Uses a simple JSON file (not encrypted) since we can't use keytar yet.
 */

import { app, ipcMain, systemPreferences } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { logger } from '@flwst/core';

import { initializeStorage } from './storage';

/** Permissions that require user explanation before triggering OS prompts */
export interface PreflightPermission {
  id: string;
  name: string;
  description: string;
  required: boolean;
  status: 'pending' | 'granted' | 'denied' | 'not_applicable';
}

export interface PreflightState {
  completed: boolean;
  completedAt?: string;
  permissions: Record<string, 'granted' | 'denied' | 'skipped'>;
}

const PREFLIGHT_FILENAME = 'preflight.json';

function getPreflightPath(): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, PREFLIGHT_FILENAME);
}

function readPreflightState(): PreflightState | null {
  const path = getPreflightPath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const data = readFileSync(path, 'utf-8');
    return JSON.parse(data) as PreflightState;
  } catch (err) {
    logger.warn('Failed to read preflight state', { err });
    return null;
  }
}

function writePreflightState(state: PreflightState): void {
  const path = getPreflightPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state, null, 2));
  } catch (err) {
    logger.error('Failed to write preflight state', { err });
  }
}

/**
 * Check if preflight has been completed.
 * Returns true if user has already acknowledged the permissions screen.
 */
export function isPreflightCompleted(): boolean {
  const state = readPreflightState();
  return state?.completed === true;
}

/**
 * Get the list of permissions to show in the preflight screen.
 */
export function getPreflightPermissions(): PreflightPermission[] {
  const permissions: PreflightPermission[] = [
    {
      id: 'keychain',
      name: 'Keychain Access',
      description:
        'FlowState securely stores your Notion credentials and encryption keys in your system keychain. You may see a system prompt asking for your password.',
      required: true,
      status: 'pending', // We can't check keychain status without triggering the prompt
    },
  ];

  // Microphone permission (macOS) - for future voice input
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    permissions.push({
      id: 'microphone',
      name: 'Microphone Access',
      description:
        'FlowState can transcribe voice notes directly (coming soon). This permission is optional and can be enabled later.',
      required: false,
      status:
        micStatus === 'granted'
          ? 'granted'
          : micStatus === 'denied'
            ? 'denied'
            : 'pending',
    });
  }

  return permissions;
}

/**
 * Complete the preflight check and initialize storage.
 * Called after user acknowledges the permissions screen.
 */
export function completePreflight(): void {
  logger.info('Completing preflight, initializing storage');

  // Initialize keytar-based storage (this may trigger keychain prompt)
  initializeStorage();

  // Mark preflight as completed
  const state: PreflightState = {
    completed: true,
    completedAt: new Date().toISOString(),
    permissions: {
      keychain: 'granted', // If we get here without error, keychain worked
    },
  };
  writePreflightState(state);

  logger.info('Preflight completed');
}

/**
 * Request microphone permission (macOS only).
 * Returns the new status.
 */
export async function requestMicrophonePermission(): Promise<
  'granted' | 'denied' | 'restricted'
> {
  if (process.platform !== 'darwin') {
    return 'granted'; // Non-macOS doesn't need explicit permission
  }

  const granted = await systemPreferences.askForMediaAccess('microphone');
  return granted ? 'granted' : 'denied';
}

/**
 * Register IPC handlers for preflight flow.
 */
export function registerPreflightHandlers(): void {
  ipcMain.handle('preflight:isCompleted', () => {
    return isPreflightCompleted();
  });

  ipcMain.handle('preflight:getPermissions', () => {
    return getPreflightPermissions();
  });

  ipcMain.handle('preflight:complete', () => {
    completePreflight();
    return { success: true };
  });

  ipcMain.handle('preflight:requestMicrophone', async () => {
    const status = await requestMicrophonePermission();
    return { status };
  });
}
