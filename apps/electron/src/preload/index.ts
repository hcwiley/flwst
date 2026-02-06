import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type { OnboardingState, UserConfig } from '@flwst/types';

interface EffectivePrompts {
  dailyNote: string;
  taskDraft: string;
}

interface InboxIngestRequest {
  filename?: string;
  content: string;
}

// Custom APIs for renderer
const api = {
  onboarding: {
    getState: (): Promise<OnboardingState> =>
      ipcRenderer.invoke('onboarding:getState'),
    updateState: (partial: Partial<OnboardingState>): Promise<void> =>
      ipcRenderer.invoke('onboarding:updateState', partial),
  },
  config: {
    read: (): Promise<UserConfig> => ipcRenderer.invoke('config:read'),
    update: (partial: Partial<UserConfig>): Promise<UserConfig> =>
      ipcRenderer.invoke('config:update', partial),
    resetPrompt: (
      key: 'dailyNote' | 'taskDraft',
    ): Promise<{ config: UserConfig; effective: EffectivePrompts }> =>
      ipcRenderer.invoke('config:resetPrompt', key),
    getEffectivePrompts: (): Promise<EffectivePrompts> =>
      ipcRenderer.invoke('config:getEffectivePrompts'),
    getPromptDefaults: (): Promise<EffectivePrompts> =>
      ipcRenderer.invoke('config:getPromptDefaults'),
  },
  inbox: {
    ingestText: (payload: InboxIngestRequest) =>
      ipcRenderer.invoke('inbox:ingestText', payload),
  },
  llm: {
    generate: (request: import('@flwst/types').GenerateRequest) =>
      ipcRenderer.invoke('llm:generate', request),
  },
  artifacts: {
    readTextFile: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('artifacts:readTextFile', filePath),
  },
  notion: {
    startOAuth: (): Promise<{ authUrl: string }> =>
      ipcRenderer.invoke('notion:startOAuth'),
    storeOAuthResult: (result: {
      accessToken: string;
      workspace: {
        workspaceId: string;
        workspaceName?: string;
        botId?: string;
      };
    }): Promise<void> => ipcRenderer.invoke('notion:storeOAuthResult', result),
    setParentPage: (parentPageId: string): Promise<void> =>
      ipcRenderer.invoke('notion:setParentPage', parentPageId),
    createResources: (options: {
      parentPageId: string;
    }): Promise<{
      flowStatePageId: string;
      dailyNotesDbId: string;
      tasksDbId: string;
    }> => ipcRenderer.invoke('notion:createResources', options),
    sync: (): Promise<{ tasks: unknown[]; notes: unknown[] }> =>
      ipcRenderer.invoke('notion:sync'),
    syncTasks: (): Promise<unknown[]> => ipcRenderer.invoke('notion:syncTasks'),
    publishDrafts: (payload: import('@flwst/types').PublishPayload) =>
      ipcRenderer.invoke('notion:publishDrafts', payload),
    onSyncComplete: (
      callback: (payload: {
        success: boolean;
        tasks?: unknown[];
        notes?: unknown[];
        error?: string;
      }) => void,
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: {
          success: boolean;
          tasks?: unknown[];
          notes?: unknown[];
          error?: string;
        },
      ) => callback(payload);
      ipcRenderer.on('notion:syncComplete', handler);
      return () => ipcRenderer.removeListener('notion:syncComplete', handler);
    },
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
