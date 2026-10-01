import type { OpenRouterModel } from './openrouter';

// This is an explicit, billable admission choice, not a task-model fallback.
// Do not accept arbitrary reviewer IDs or a provider's auto/meta-router here.
export const BLUE_APPROVAL_REVIEWER_MODEL = 'openai/gpt-5.4-mini';

export function normalizeApprovalReviewer(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value !== BLUE_APPROVAL_REVIEWER_MODEL) {
    throw new Error('The selected Blue approval reviewer is not supported');
  }
  return value;
}

export function approvalReviewerFromCatalog(models: OpenRouterModel[], requested: string): OpenRouterModel {
  if (requested !== BLUE_APPROVAL_REVIEWER_MODEL) throw new Error('The selected Blue approval reviewer is not supported');
  const model = models.find(candidate =>
    (candidate.provider_route_id || candidate.id) === requested
  );
  if (!model) throw new Error('The Blue approval reviewer is unavailable in the provider catalogue');
  const parameters = new Set(model.supported_parameters || []);
  if (!['tools', 'response_format', 'structured_outputs', 'reasoning', 'reasoning_effort']
    .every(parameter => parameters.has(parameter))) {
    throw new Error('The Blue approval reviewer does not advertise the required native review capabilities');
  }
  const prompt = Number(model.pricing?.prompt);
  const completion = Number(model.pricing?.completion);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion) || prompt < 0 || completion <= 0) {
    throw new Error('The Blue approval reviewer pricing could not be verified');
  }
  return model;
}

/** is_free remains the coding route identity, not a whole-task billing flag. */
export function runtimeTaskIsBillable(task: { is_free: boolean; reviewer_model?: string | null }): boolean {
  return !task.is_free || Boolean(task.reviewer_model);
}

export function runtimeAllowedModelSet(codingModel: string, reviewerModel?: string | null): string[] {
  return Array.from(new Set([codingModel, ...(reviewerModel ? [reviewerModel] : [])])).sort();
}

interface ReviewedRuntimeIdentity {
  device_hash: string;
  payload_hash: string;
  model: string;
  mode: string;
  is_free: boolean;
  reviewer_model?: string | null;
}

/** A retry may arrive after its existing hold used the wallet's final credits. */
export function reviewedRuntimeReplayAllowance(
  task: ReviewedRuntimeIdentity & { requested_blue_credits: number | string },
  expected: ReviewedRuntimeIdentity
): number {
  if (!expected.reviewer_model || task.device_hash !== expected.device_hash
    || task.payload_hash !== expected.payload_hash || task.model !== expected.model
    || task.mode !== expected.mode || task.is_free !== expected.is_free
    || task.reviewer_model !== expected.reviewer_model) {
    throw new Error('This Blue task ID was already used with different runtime settings');
  }
  const allowance = Number(task.requested_blue_credits);
  if (!Number.isFinite(allowance) || allowance <= 0) {
    throw new Error('The existing reviewed Blue task has an invalid runtime allowance');
  }
  return allowance;
}
