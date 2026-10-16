/**
 * Asset manifest types — Phase 3 / Slice E-1 of the agentic-harness plan.
 *
 * The manifest is the canonical "three-layer" mapping for every asset
 * the LLM might reference in a session:
 *
 *   asset_id    — internal stable handle (never shown to the user)
 *   user_label  — human-readable name the user / LLM use in conversation
 *   model_ref   — the literal token a given model expects in its prompt
 *                 (Seedance "@Image1", GPT-Image-2 "Image 1",
 *                  HappyHorse "[Image 1]", Wan 3 "Image 1",
 *                  context-conditioned
 *                  "context_image_0", etc.)
 *
 * The portable contract lives here so chat (Path A), the hosted API
 * (Path B), the public skill, and the SDK can all consume the same
 * shapes. Per-session storage of the manifest is each consumer's
 * responsibility — chat keeps it in `assetManifestStore`.
 */

export type AssetType = 'image' | 'video' | 'audio';

/** Single asset entry in the manifest. */
export interface AssetRecord {
  /** Internal stable id — does not change as the user renames the asset. */
  asset_id: string;
  /** Human-readable name. Surfaces to the user; the LLM uses this in prose. */
  user_label: string;
  /** Free-form description. Optional. */
  description?: string;
  /** Asset type — drives how `model_ref` is formatted for context-conditioned models. */
  type: AssetType;
  /** Optional URL pointing at the asset (uploaded file or generated result). */
  url?: string;
  /** Visual / acoustic features the LLM must preserve when re-generating from this asset. */
  must_preserve?: readonly string[];
  /** Features the LLM must avoid (e.g. "no text", "no watermark"). */
  avoid?: readonly string[];
  /** Free-form metadata — width/height/duration/etc. Opaque to the manifest. */
  metadata?: Readonly<Record<string, unknown>>;
}

/** Container for every asset known in a session. */
export interface AssetManifest {
  assets: readonly AssetRecord[];
  /** Monotonic counter used to mint stable asset_ids. */
  next_index: number;
  /** ISO timestamp of last mutation. */
  updated_at: string;
}

/** Identifiers we know how to format model_ref for out of the box. */
export type KnownAssetModelId =
  | 'seedance'
  | 'happyhorse'
  | 'wan3'
  | 'ltx23'
  | 'ltx25'
  | 'gpt-image-2'
  | 'wan'
  | 'qwen-image-edit'
  | 'krea-identity-edit'
  | 'flux3-klein'
  | 'flux'
  | 'minimax-h3';

/**
 * Result of `validateAssetReferences()` — surfaces concrete dangling
 * references back to the LLM so it can repair the prompt rather than
 * burn a worker round on a phantom citation.
 */
export interface AssetReferenceValidationResult {
  /** Tokens that resolved to a known asset_id. */
  resolved: ReadonlyArray<{
    token: string;
    asset_id: string;
    user_label: string;
  }>;
  /** Tokens we recognized as references but could not resolve. */
  dangling: ReadonlyArray<{
    token: string;
    reason: 'unknown_label' | 'unknown_model_ref' | 'index_out_of_range' | 'wrong_model_ref_format';
    expected_model_id?: string;
  }>;
  /**
   * `user_label` strings that appear in the prompt but were never declared
   * in the manifest. May be false positives (the LLM mentioned a real
   * subject that isn't a manifest asset) — surfaced as a warning, not
   * a hard error.
   */
  ambiguous_labels: readonly string[];
}
