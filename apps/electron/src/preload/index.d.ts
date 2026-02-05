import { ElectronAPI } from '@electron-toolkit/preload';
import type {
  GenerateRequest,
  GenerateResponse,
  NotionDailyNotePage,
  NotionTaskPage,
  OnboardingState,
  NotionWorkspaceMetadata,
  UserConfig,
  RunId,
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

export type NotionSyncCompletePayload =
  | { success: true; tasks: NotionTaskPage[]; notes: NotionDailyNotePage[] }
  | { success: false; error: string };

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
  sync: () => Promise<{
    tasks: NotionTaskPage[];
    notes: NotionDailyNotePage[];
  }>;
  syncTasks: () => Promise<NotionTaskPage[]>;
  onSyncComplete: (
    callback: (payload: NotionSyncCompletePayload) => void,
  ) => () => void;
}

export interface InboxIngestRequest {
  filename?: string;
  content: string;
}

export interface InboxIngestResult {
  runId: RunId;
  timestamp: string;
  filename: string;
  rawPath: string;
  cleanPath: string;
  logsPath: string;
  bundlePath: string;
  // LLM output paths
  llmRawPath: string;
  dailyNotePath: string;
  dailyNotePropsPath: string;
  taskFeedPath: string;
  taskFeedPropsPath: string;
  // LLM metadata
  llmDurationMs: number;
  llmSuccess: boolean;
  llmError?: string;
}

export interface InboxAPI {
  ingestText: (payload: InboxIngestRequest) => Promise<InboxIngestResult>;
}

export interface LlmAPI {
  generate: (request: GenerateRequest) => Promise<GenerateResponse>;
}

export interface ArtifactsAPI {
  readTextFile: (filePath: string) => Promise<string>;
}

export interface AppAPI {
  onboarding: OnboardingAPI;
  config: ConfigAPI;
  inbox: InboxAPI;
  llm: LlmAPI;
  artifacts: ArtifactsAPI;
  notion: NotionAPI;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: AppAPI;
  }
}
