/**
 * Shared LoRA guidance for the image tool schemas.
 *
 * Every tool that accepts `loras` sends this text on every request, and hosts
 * do load `edit_image` without `generate_image` — the `image_editing` skill
 * subset is exactly that, and exists to keep a session's token footprint small.
 * So each tool has to stand on its own rather than point at a sibling's
 * description, and the cost of that is paid twice whenever both load.
 *
 * Keep additions terse and push anything a caller can look up at runtime behind
 * the catalog endpoint named below. The sign convention is stated once here
 * rather than repeated per LoRA precisely because it holds for all 19 sliders.
 */

/**
 * The Krea 2 catalog an LLM needs to name a LoRA without a round trip.
 *
 * Every bipolar slider's id names its positive direction (verified against the
 * catalog's own `rangeLabels`), so only the three whose names do not imply a
 * direction carry a hint.
 *
 * Deliberately omits maturity flags and the age/adult-content rule the render
 * pipeline enforces. Both are rejected at submit — before any credit or GPU
 * time is spent — with an error that names its own fix, so restating them here
 * would buy a rare retry at the cost of every request that loads these tools.
 * They live in the skill's `references/krea2-loras.md`, which costs nothing per
 * request, and in the catalog endpoint's own `ui.nsfw` / `ui.sexual` fields.
 */
export const KREA2_LORA_CATALOG_REFERENCE =
  'Bipolar sliders — each id names its POSITIVE direction, a negative strength applies the ' +
  'opposite, and 0 disables it: krea2-detail-enhancer, krea2-scene-complexity, krea2-realism ' +
  '(+ = photoreal), krea2-amateur, krea2-candid, krea2-zoom (+ = zoomed in), krea2-skin-detail, ' +
  'krea2-wetness, krea2-age, krea2-height, krea2-weight, krea2-hourglass-figure, krea2-breast, ' +
  'krea2-chest-firmness, krea2-nipple-projection, krea2-warm-light, krea2-afterlight ' +
  '(+ = golden), krea2-skin-tone (+ = darker), krea2-purple-grainy (+ = grainy and muted). ' +
  'Positive-only fine-tunes: krea2-realism-engine (photographic realism), krea2-bloomgirls ' +
  '(polished influencer look), krea2-mystic-x (uncensored adult), krea2-aberrant (industrial ' +
  'body horror), krea2-filter-bypass-2 and krea2-filter-bypass-3 (restore expressions, anatomy ' +
  'and poses the base model flattens; try the 2-vector first). ' +
  'Exact per-LoRA ranges, maturity flags and the full contract: ' +
  'GET /v1/loras/comfy?modelId=<model>. Do not invent ids.';

/** Shared `loraStrengths` guidance: bipolarity, defaults, and usable bands. */
export const LORA_STRENGTHS_GUIDANCE =
  'Strength for each LoRA in loras, in the same order. Omitting the array uses 1.0 for every ' +
  'LoRA, which is not each LoRA\'s catalog default — krea2-chest-firmness, ' +
  'krea2-nipple-projection and krea2-height default to 0 (no effect) — so prefer explicit ' +
  'values. Do NOT clamp to 0-1: most Krea 2 LoRAs are bipolar, so krea2-warm-light warms the ' +
  'grade at 2 and cools it at -2. Usable bands vary per LoRA — roughly -2..5 for ' +
  'krea2-detail-enhancer, -3..3 for krea2-warm-light, 3..9 for krea2-candid, 0.5..1 for ' +
  'krea2-realism-engine, 1..2 for the filter-bypass pair. Scale the magnitude to how strongly ' +
  'the user asked; the server clamps out-of-range values, and pushing past a LoRA\'s ' +
  'recommended band costs image quality rather than adding effect. Preserve explicit user ' +
  'values. Example: loras=["krea2-detail-enhancer","krea2-amateur"], loraStrengths=[3,-2].';

/** Stacking contract, identical wherever LoRAs are accepted. */
export const LORA_STACKING_GUIDANCE =
  'Stack up to 8 in one request; order matters because the adapters apply in sequence and do ' +
  'not commute. Keep this array positionally aligned with loraStrengths. The first render with ' +
  'an uncached LoRA takes longer to start while the worker downloads it.';

/** Every model id that accepts these LoRAs, named so the LLM can pick a compatible one. */
export const KREA2_LORA_MODEL_IDS_SENTENCE =
  'Accepted only by the five Krea 2 based models: krea2_turbo_fp8_scaled (text-to-image), ' +
  'krea2_identity_edit_v1_2 and krea2_identity_edit_sogni_v0_3_alpha (identity edit), and the ' +
  'dark_beast_krea2_fp8 / dark_beast_krea2_identity_edit_v1_2 community variants.';

/**
 * The MiniMax H3 video LoRA catalog.
 *
 * Video LoRAs are a different shape from the Krea 2 sliders: positive-only, one
 * file per family rather than one per effect, and gated on a trigger word that
 * has to reach the prompt. State the trigger here because a request that omits
 * it renders a normal H3 video and looks like the LoRA silently failed.
 *
 * Split across generate_video (t2v, r2v) and animate_photo (i2v, flf2v) because
 * that is how the H3 modes are split across the two tools; each names only its
 * own selectors so neither sends the other's.
 */
export const H3_VIDEO_LORA_CATALOG_REFERENCE =
  'Five LoRAs are published for MiniMax H3 today and the set differs by mode, so '
  + 'GET /v1/loras/comfy?modelId=<model> is authoritative for the mode in hand and carries exact '
  + 'ranges, maturity flags, and anything published since. h3-realism-people (fal) is a realism '
  + 'pass trained on live-action footage of people: it restores skin texture and pores, stray '
  + 'hairs, fabric weave and a fine sensor grain that the base model smooths away, and holds up in '
  + 'close-up. It is the only one gated on a trigger word — put r34l1sm near the FRONT of the '
  + 'prompt, or the render comes back as ordinary H3 with no error. h3-vbvr-video-reasoning is a '
  + 'prompt-adherence pass that holds the model to what was asked instead of improvising. '
  + 'h3-natural-face-speech (AdaptiveVision) makes people talking on camera look and sound more '
  + 'natural: cheeks, brows, jaw and lips move together as in real speech, and spoken English comes '
  + 'through clearer; use it for talking-head shots such as vlogs, podcasts, interviews and '
  + 'presenters. h3-better-motion (AdaptiveVision) gives people more natural, consistent body '
  + 'movement — weight shifts, strides, turns and gestures that follow through — for dance, '
  + 'sport, walking and other full-body shots. Both AdaptiveVision LoRAs work best with short, '
  + 'simple prompt sentences and are not validated on reference-to-video. h3-mystic-xxx-v4 is an '
  + 'uncensored adult fine-tune. Do not invent ids.';

/** Shared video `loraStrengths` guidance: positive-only, and what pushing it costs. */
export const H3_VIDEO_LORA_STRENGTHS_GUIDANCE =
  'Strength for each LoRA in loras, in the same order. Omitting the array applies 1.0 to every '
  + 'LoRA, which is not every LoRA\'s catalog default and for h3-realism-people is already at the '
  + 'top of its band, so send explicit values. Video LoRAs are positive-only — unlike the bipolar Krea 2 image '
  + 'sliders, a negative value is not an inverse effect and 0 is off. h3-realism-people takes 0-2 '
  + 'and its catalog default is 0.8; 0.6-1 is the '
  + 'usable band. It also pulls the camera in as it climbs: at 1.5 and above the shot reliably '
  + 'recomposes and the grade darkens, which on an image-conditioned mode can crop the subject out '
  + 'of the frame the user supplied. Raise it above 1 only when the user asks for more, and prefer '
  + 'the default when they supplied a first or last frame. h3-vbvr-video-reasoning and '
  + 'h3-mystic-xxx-v4 both take 0-1 and do default to 1.0, with usable bands of 0.7-1 and 0.2-1. '
  + 'h3-natural-face-speech and h3-better-motion take 0-1.5 and default to 0.6; their usable band '
  + 'is 0.4-0.8.';

/**
 * Which selectors accept the H3 LoRAs, in the vocabulary of one tool.
 *
 * Written per tool rather than as one shared list: an LLM reading animate_photo
 * cannot set videoModel="minimax-h3-t2v" there, and naming it invites the try.
 */
export function h3LoraModelSentence(selectors: readonly string[]): string {
  return (
    `Accepted only when videoModel is one of ${selectors.map(selector => `"${selector}"`).join(', ')}. `
    + 'Every other video model on this tool loads no LoRAs and silently ignores these arrays, so set '
    + 'videoModel to an H3 mode in the same call when the user asks for one.'
  );
}
