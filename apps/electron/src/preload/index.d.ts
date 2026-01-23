import { ElectronAPI } from '@electron-toolkit/preload';
import type { OnboardingState, NotionWorkspaceMetadata } from '@flwst/types';

export interface OnboardingAPI {
  getState: () => Promise<OnboardingState>;
  updateState: (partial: Partial<OnboardingState>) => Promise<void>;
}

export interface NotionAPI {
  startOAuth: () => Promise<{ authUrl: string }>;
  storeOAuthResult: (result: {
    accessToken: string;
    workspace: NotionWorkspaceMetadata;
  }) => Promise<void>;
  setParentPage: (parentPageId: string) => Promise<void>;
  createResources: (options: {
    parentPageId: string;
  }) => Promise<{
    flowStatePageId: string;
    dailyNotesDbId: string;
    tasksDbId: string;
  }>;
}

export interface AppAPI {
  onboarding: OnboardingAPI;
  notion: NotionAPI;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AppAPI;
  }
}
