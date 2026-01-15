/**
 * Renderer-side API facade.
 *
 * Validates all requests/responses at the boundary to keep IPC + HTTP type-safe.
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

const DEFAULT_REASONING_PORT = 3000;
const HEALTH_CHECK_TIMEOUT_MS = 3000;
const REQUEST_TIMEOUT_MS = 120000;

let healthCheckPromise: Promise<void> | null = null;

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

const getReasoningBaseUrl = (): string => {
  const config = window?.reasoningConfig;
  if (config?.baseUrl) return config.baseUrl;
  if (config?.port) return `http://localhost:${config.port}`;
  return `http://localhost:${DEFAULT_REASONING_PORT}`;
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const ensureReasoningReady = async (baseUrl: string): Promise<void> => {
  if (healthCheckPromise) return healthCheckPromise;

  healthCheckPromise = (async () => {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/health`,
        { method: 'GET' },
        HEALTH_CHECK_TIMEOUT_MS,
        'Reasoning server health check',
      );
      if (!response.ok) {
        throw new Error(`Health check failed with ${response.status}`);
      }
    } catch (error) {
      healthCheckPromise = null;
      throw new Error(
        'Reasoning server unavailable. Please wait for it to start and try again.',
      );
    }
  })();

  return healthCheckPromise;
};

const postReasoning = async <TReq, TRes>(
  path: string,
  requestSchema: { parse: (value: TReq) => TReq },
  responseSchema: { parse: (value: TRes) => TRes },
  payload: TReq,
): Promise<TRes> => {
  const baseUrl = getReasoningBaseUrl();
  const validatedRequest = requestSchema.parse(payload);
  await ensureReasoningReady(baseUrl);

  const response = await fetchWithTimeout(
    `${baseUrl}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    },
    REQUEST_TIMEOUT_MS,
    'Reasoning request',
  );

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = responseBody?.error ?? `Reasoning server error (${response.status})`;
    throw new Error(message);
  }

  return responseSchema.parse(responseBody);
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
    postReasoning('/process', ProcessTranscriptRequestSchema, ProcessTranscriptResponseSchema, payload),
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
