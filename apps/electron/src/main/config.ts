/**
 * IPC handlers for user config (preprocess, prompt overrides).
 * Defaults for prompts come from @flwst/prompts; config stores overrides only.
 */

import { ipcMain } from 'electron';
import { getLogger } from './sentry';
import { getConfigStore } from './storage';
import { defaultPrompts } from '@flwst/prompts';
import type { UserConfig, PromptOverrides } from '@flwst/types';
import { UserConfigSchema } from '@flwst/types';

export type EffectivePrompts = {
  dailyNote: string;
  taskDraft: string;
};

/**
 * Resolve effective prompt: override if present, else library default.
 */
export function getEffectivePrompts(
  overrides: PromptOverrides,
): EffectivePrompts {
  return {
    dailyNote: overrides.dailyNote ?? defaultPrompts.dailyNote.template,
    taskDraft: overrides.taskDraft ?? defaultPrompts.taskDraft.template,
  };
}

/**
 * Register config IPC handlers.
 * Should be called after storage is initialized.
 */
export function registerConfigHandlers(): void {
  const logger = getLogger();

  ipcMain.handle('config:read', async (): Promise<UserConfig> => {
    try {
      const configStore = getConfigStore();
      return await configStore.read();
    } catch (error) {
      logger.error('Failed to read config', { error });
      throw error;
    }
  });

  ipcMain.handle(
    'config:update',
    async (_event, partial: Partial<UserConfig>): Promise<UserConfig> => {
      try {
        const configStore = getConfigStore();
        const current = await configStore.read();
        const updated: UserConfig = UserConfigSchema.parse({
          ...current,
          ...partial,
        });
        await configStore.write(updated);
        logger.info('Config updated');
        return updated;
      } catch (error) {
        logger.error('Failed to update config', { error });
        throw error;
      }
    },
  );

  ipcMain.handle(
    'config:resetPrompt',
    async (
      _event,
      key: 'dailyNote' | 'taskDraft',
    ): Promise<{ config: UserConfig; effective: EffectivePrompts }> => {
      try {
        const configStore = getConfigStore();
        const current = await configStore.read();
        const prompts = { ...current.prompts };
        delete prompts[key];
        const updated: UserConfig = UserConfigSchema.parse({
          ...current,
          prompts,
        });
        await configStore.write(updated);
        const effective = getEffectivePrompts(updated.prompts);
        logger.info('Prompt reset to default', { key });
        return { config: updated, effective };
      } catch (error) {
        logger.error('Failed to reset prompt', { error, key });
        throw error;
      }
    },
  );

  ipcMain.handle(
    'config:getEffectivePrompts',
    async (): Promise<EffectivePrompts> => {
      try {
        const configStore = getConfigStore();
        const config = await configStore.read();
        return getEffectivePrompts(config.prompts);
      } catch (error) {
        logger.error('Failed to get effective prompts', { error });
        throw error;
      }
    },
  );

  ipcMain.handle(
    'config:getPromptDefaults',
    async (): Promise<EffectivePrompts> => {
      return getEffectivePrompts({});
    },
  );
}
