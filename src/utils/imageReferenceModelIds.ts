export type RegisteredImageReferenceModelId =
  | 'gpt-image-2'
  | 'qwen-image-edit'
  | 'krea-identity-edit'
  | 'flux';

function normalizeImageReferenceModelId(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/[_.\s]+/g, '-').replace(/-+/g, '-');
}

// This is the reference grammar family, not a model selector. All three use
// ordered "Image 1" references; callers must retain the selected model ID.
const GPT_IMAGE_2_REFERENCE_MODEL_IDS = new Set(['gpt-image-2', 'gpt-image-2-5-sunburst', 'gpt-image-2-5-flare']);

const QWEN_EDIT_REFERENCE_MODEL_IDS = new Set([
  'qwen',
  'qwen-lightning',
  'qwen-image-edit',
  'qwen-image-edit-2511',
  'qwen-image-edit-2511-lightning',
  'qwen-image-edit-2511-fp8',
  'qwen-image-edit-2511-fp8-lightning',
]);

const KREA_IDENTITY_EDIT_REFERENCE_MODEL_IDS = new Set([
  'krea-identity-edit',
  'krea-2-identity-edit',
  'krea2-identity-edit',
  'krea2-identity-edit-v1-2',
  'dark-beast-krea2-identity-edit',
  'dark-beast-krea-2-identity-edit',
  'dark-beast-krea2-identity-edit-v1-2',
  'dark-beast-krea-2-identity-edit-v1-2',
  'krea2-identity-edit-sogni-v0-3-alpha',
]);

/**
 * Exact image-reference grammar registry.
 *
 * Prompt grammar and catalog recognition are intentionally not inputs here:
 * neither proves that a model accepts reference images or which token syntax
 * it expects. The literal `flux` entry is retained solely for legacy manifests.
 */
export function resolveRegisteredImageReferenceModelId(
  modelId: string,
): RegisteredImageReferenceModelId | null {
  const normalized = normalizeImageReferenceModelId(modelId);
  if (GPT_IMAGE_2_REFERENCE_MODEL_IDS.has(normalized)) return 'gpt-image-2';
  if (QWEN_EDIT_REFERENCE_MODEL_IDS.has(normalized)) return 'qwen-image-edit';
  if (KREA_IDENTITY_EDIT_REFERENCE_MODEL_IDS.has(normalized)) return 'krea-identity-edit';
  if (normalized === 'flux') return 'flux';
  return null;
}
