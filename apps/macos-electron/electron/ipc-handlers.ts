/**
 * IPC handler registration for Electron main.
 *
 * Validates payloads with Zod and delegates to Notion gateway and reasoning subprocess.
 */
import { ipcMain } from 'electron';
import {
  BootstrapMirrorRequestSchema,
  BootstrapMirrorResponseSchema,
  NotionConnectResponseSchema,
  NotionStatusResponseSchema,
  ProcessTranscriptRequestSchema,
  ProcessTranscriptResponseSchema,
  RefreshKanbanRequestSchema,
  RefreshKanbanResponseSchema,
  SubmitOneRequestSchema,
  SubmitOneResponseSchema,
  SubmitSessionRequestSchema,
  SubmitSessionResponseSchema,
} from '@flwst/types/src/api/reasoning';
import { NotionGateway } from './notion-gateway.js';
import { ReasoningSubprocess } from './reasoning-subprocess.js';
import { NotionAuth } from './notion-auth.js';

/**
 * Register IPC handlers once at app startup.
 */
export function registerIpcHandlers() {
  const gateway = new NotionGateway();
  const reasoningSubprocess = new ReasoningSubprocess();
  const notionAuth = new NotionAuth();

  ipcMain.handle('notion:bootstrapMirror', async (_event, payload) => {
    BootstrapMirrorRequestSchema.parse(payload);
    const response = await gateway.bootstrapMirror();
    return BootstrapMirrorResponseSchema.parse(response);
  });

  ipcMain.handle('notion:refreshKanban', async (_event, payload) => {
    RefreshKanbanRequestSchema.parse(payload);
    const response = await gateway.refreshKanban();
    return RefreshKanbanResponseSchema.parse(response);
  });

  ipcMain.handle('reasoning:processTranscript', async (_event, payload) => {
    const request = ProcessTranscriptRequestSchema.parse(payload);
    const response = await reasoningSubprocess.processTranscript(request);
    return ProcessTranscriptResponseSchema.parse(response);
  });

  ipcMain.handle('notion:submitSession', async (_event, payload) => {
    const request = SubmitSessionRequestSchema.parse(payload);
    const response = await gateway.submitSession(request);
    return SubmitSessionResponseSchema.parse(response);
  });

  ipcMain.handle('notion:submitOne', async (_event, payload) => {
    const request = SubmitOneRequestSchema.parse(payload);
    const response = await gateway.submitOne(request);
    return SubmitOneResponseSchema.parse(response);
  });

  ipcMain.handle('notion:status', async () => {
    const response = await notionAuth.getStatus();
    return NotionStatusResponseSchema.parse(response);
  });

  ipcMain.handle('notion:connect', async () => {
    const response = await notionAuth.connect();
    return NotionConnectResponseSchema.parse(response);
  });
}
