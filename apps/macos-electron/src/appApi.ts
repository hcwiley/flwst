/**
 * Renderer-side IPC facade.
 *
 * Validates all requests/responses at the boundary to keep IPC type-safe.
 */
import {
  BootstrapMirrorRequestSchema,
  BootstrapMirrorResponseSchema,
  NotionConnectRequestSchema,
  NotionConnectResponseSchema,
  NotionStatusRequestSchema,
  NotionStatusResponseSchema,
  ProcessTranscriptRequestSchema,
  ProcessTranscriptResponseSchema,
  RefreshKanbanRequestSchema,
  RefreshKanbanResponseSchema,
  SubmitOneRequestSchema,
  SubmitOneResponseSchema,
  SubmitSessionRequestSchema,
  SubmitSessionResponseSchema,
  type BootstrapMirrorResponse,
  type NotionConnectResponse,
  type NotionStatusResponse,
  type ProcessTranscriptRequest,
  type ProcessTranscriptResponse,
  type RefreshKanbanRequest,
  type RefreshKanbanResponse,
  type SubmitOneRequest,
  type SubmitOneResponse,
  type SubmitSessionRequest,
  type SubmitSessionResponse,
} from '@flwst/types/src/api/reasoning';

export type AppApi = {
  bootstrapMirror: () => Promise<BootstrapMirrorResponse>;
  notionStatus: () => Promise<NotionStatusResponse>;
  notionConnect: () => Promise<NotionConnectResponse>;
  refreshKanban: (payload: RefreshKanbanRequest) => Promise<RefreshKanbanResponse>;
  processTranscript: (payload: ProcessTranscriptRequest) => Promise<ProcessTranscriptResponse>;
  submitSession: (payload: SubmitSessionRequest) => Promise<SubmitSessionResponse>;
  submitOne: (payload: SubmitOneRequest) => Promise<SubmitOneResponse>;
};

const invoke = async <TReq, TRes>(
  channel: string,
  requestSchema: { parse: (value: TReq) => TReq },
  responseSchema: { parse: (value: TRes) => TRes },
  payload: TReq,
): Promise<TRes> => {
  if (!window?.ipcRenderer?.invoke) {
    throw new Error('IPC unavailable: run inside Electron.');
  }
  const validatedRequest = requestSchema.parse(payload);
  const rawResponse = await window.ipcRenderer.invoke(channel, validatedRequest);
  return responseSchema.parse(rawResponse);
};

export const appApi: AppApi = {
  bootstrapMirror: async () =>
    invoke(
      'notion:bootstrapMirror',
      BootstrapMirrorRequestSchema,
      BootstrapMirrorResponseSchema,
      {},
    ),
  notionStatus: async () =>
    invoke('notion:status', NotionStatusRequestSchema, NotionStatusResponseSchema, {}),
  notionConnect: async () =>
    invoke('notion:connect', NotionConnectRequestSchema, NotionConnectResponseSchema, {}),
  refreshKanban: async (payload) =>
    invoke(
      'notion:refreshKanban',
      RefreshKanbanRequestSchema,
      RefreshKanbanResponseSchema,
      payload,
    ),
  processTranscript: async (payload) =>
    invoke(
      'reasoning:processTranscript',
      ProcessTranscriptRequestSchema,
      ProcessTranscriptResponseSchema,
      payload,
    ),
  submitSession: async (payload) =>
    invoke(
      'notion:submitSession',
      SubmitSessionRequestSchema,
      SubmitSessionResponseSchema,
      payload,
    ),
  submitOne: async (payload) =>
    invoke('notion:submitOne', SubmitOneRequestSchema, SubmitOneResponseSchema, payload),
};
