import { ElectronAPI } from '@electron-toolkit/preload';
import type {
  OnboardingState,
  NotionWorkspaceMetadata,
  UserConfig,
} from '@flwst/types';

export interface OnboardingAPI {
  getState: () => Promise<OnboardingState>;
  updateState: (partial: Partial<OnboardingState>) => Promise<void>;
}

export type EffectivePrompts = { dailyNote: string; taskDraft: string };

export interface ConfigAPI {
  read: () => Promise<UserConfig>;
  update: (partial: Partial<UserConfig>) => Promise<UserConfig>;
  resetPrompt: (
    key: 'dailyNote' | 'taskDraft',
  ) => Promise<{ config: UserConfig; effective: EffectivePrompts }>;
  getEffectivePrompts: () => Promise<EffectivePrompts>;
  getPromptDefaults: () => Promise<EffectivePrompts>;
}

export interface NotionAPI {
  startOAuth: () => Promise<{ authUrl: string }>;
  storeOAuthResult: (result: {
    accessToken: string;
    workspace: NotionWorkspaceMetadata;
  }) => Promise<void>;
  setParentPage: (parentPageId: string) => Promise<void>;
  createResources: (options: { parentPageId: string }) => Promise<{
    flowStatePageId: string;
    dailyNotesDbId: string;
    tasksDbId: string;
  }>;
}

export interface AppAPI {
  onboarding: OnboardingAPI;
  config: ConfigAPI;
  notion: NotionAPI;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AppAPI;
  }
}
