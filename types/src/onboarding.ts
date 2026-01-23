/**
 * Onboarding and Notion workspace state types.
 */

import { z } from 'zod';

/**
 * Notion connection status enum.
 * Transitions: disconnected -> oauth_pending -> authed -> parent_selected -> resources_created -> ready (alias) or error
 */
export const NotionStatusSchema = z.enum([
  'disconnected',
  'oauth_pending',
  'authed',
  'parent_selected',
  'resources_created',
  'ready',
  'error',
]);

export type NotionStatus = z.infer<typeof NotionStatusSchema>;

/**
 * Notion workspace metadata captured during OAuth.
 */
export const NotionWorkspaceMetadataSchema = z.object({
  workspaceId: z.string(),
  workspaceName: z.string().optional(),
  botId: z.string().optional(),
});

export type NotionWorkspaceMetadata = z.infer<
  typeof NotionWorkspaceMetadataSchema
>;

/**
 * Notion workspace state.
 * Access token is stored separately in main process (TokensStore).
 */
export const NotionWorkspaceStateSchema = z.object({
  status: NotionStatusSchema,
  workspace: NotionWorkspaceMetadataSchema.optional(),
  parentPageId: z.string().optional(),
  flowStatePageId: z.string().optional(),
  dailyNotesDbId: z.string().optional(),
  tasksDbId: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type NotionWorkspaceState = z.infer<typeof NotionWorkspaceStateSchema>;

/**
 * Feature request payload.
 */
export const FeatureRequestPayloadSchema = z.object({
  system: z.string(),
  notes: z.string().optional(),
  teamSize: z.string().optional(),
  urgency: z.string().optional(),
  submittedAt: z.string().datetime(),
});

export type FeatureRequestPayload = z.infer<typeof FeatureRequestPayloadSchema>;

/**
 * Onboarding state persisted in storage.
 */
export const OnboardingStateSchema = z.object({
  onboardingCompleted: z.boolean(),
  notion: NotionWorkspaceStateSchema,
  featureRequests: z.array(FeatureRequestPayloadSchema).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

/**
 * Default onboarding state.
 */
export function getDefaultOnboardingState(): OnboardingState {
  return {
    onboardingCompleted: false,
    notion: {
      status: 'disconnected',
    },
    featureRequests: [],
  };
}
