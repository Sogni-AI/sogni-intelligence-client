/**
 * Shared, language-agnostic policy for reference-guided image-edit routing.
 *
 * Callers must derive `imageEditProfile` and `explicitModelPreference` from
 * schema-validated planner output or explicit tool arguments. This module does
 * not inspect user-visible prose.
 */

export const IMAGE_EDIT_PROFILES = [
  'identity_sensitive_portrait',
  'general_edit',
  'detail_critical_layout',
] as const;

export type ImageEditProfile = (typeof IMAGE_EDIT_PROFILES)[number];

export const IMAGE_EDIT_MODEL_PREFERENCES = [
  'gpt-image-2',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
  'qwen-lightning',
  'qwen',
  'krea-identity-edit',
  'dark-beast-krea2-identity-edit',
] as const;

export type ImageEditModelPreference =
  (typeof IMAGE_EDIT_MODEL_PREFERENCES)[number];

export const DEFAULT_IDENTITY_EDIT_MODEL: ImageEditModelPreference =
  'krea-identity-edit';

export const KREA_IDENTITY_EDIT_MODEL_IDS = [
  'krea2_identity_edit_v1_2',
  'dark_beast_krea2_identity_edit_v1_2',
] as const;

const IMAGE_EDIT_MODEL_PREFERENCE_SET = new Set<string>(
  IMAGE_EDIT_MODEL_PREFERENCES,
);

const KREA_IDENTITY_EDIT_MODEL_SET = new Set<string>([
  'krea-identity-edit',
  'dark-beast-krea2-identity-edit',
  ...KREA_IDENTITY_EDIT_MODEL_IDS,
]);

export interface ResolveImageEditModelInput {
  imageEditProfile?: ImageEditProfile | null;
  explicitModelPreference?: string | null;
  fallbackModel?: string | null;
}

export interface ImageEditExecutionControls {
  steps?: number;
  guidance?: number;
  sampler?: string;
  scheduler?: string;
}

export function normalizeImageEditModelPreference(
  value: unknown,
): ImageEditModelPreference | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return IMAGE_EDIT_MODEL_PREFERENCE_SET.has(normalized)
    ? (normalized as ImageEditModelPreference)
    : null;
}

/**
 * Resolve a model from typed semantic intent. An explicit, schema-valid model
 * always wins; otherwise identity-sensitive edits use Krea 2 Identity Edit.
 */
export function resolveImageEditModelForProfile({
  imageEditProfile,
  explicitModelPreference,
  fallbackModel,
}: ResolveImageEditModelInput): string | null {
  const explicit = normalizeImageEditModelPreference(explicitModelPreference);
  if (explicit) return explicit;
  if (imageEditProfile === 'identity_sensitive_portrait') {
    return DEFAULT_IDENTITY_EDIT_MODEL;
  }
  return typeof fallbackModel === 'string' && fallbackModel.trim()
    ? fallbackModel.trim()
    : null;
}

export function isKreaIdentityEditModel(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return KREA_IDENTITY_EDIT_MODEL_SET.has(value.trim().toLowerCase());
}

/**
 * Krea identity-edit execution defaults are owned by the live model tier and
 * worker, while deliberately supplied user controls remain authoritative.
 * Other edit models retain the resolved controls supplied by the host.
 */
export function buildImageEditExecutionControls(
  model: string,
  controls: ImageEditExecutionControls,
  explicitControls: ImageEditExecutionControls = {},
): ImageEditExecutionControls {
  const selectedControls = isKreaIdentityEditModel(model)
    ? explicitControls
    : controls;
  return Object.fromEntries(
    Object.entries(selectedControls).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as ImageEditExecutionControls;
}
