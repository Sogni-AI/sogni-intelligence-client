/**
 * Tool definition for edit_image.
 * Based on workflow_image_edit.mjs and MODELS.imageEdit config.
 */

import type { ToolDefinition } from '../types.js';
import {
  KREA2_LORA_CATALOG_REFERENCE,
  LORA_STACKING_GUIDANCE,
  LORA_STRENGTHS_GUIDANCE,
} from '../../shared/loraGuidance.js';
import { LITERAL_PROMPT_OVERRIDE } from '../../../contracts/promptOverrideMarker.js';
import { ASPECT_RATIO_DESCRIPTION } from '../../../media/index.js';

export const definition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_image',
    description:
      'Generate or edit images using reference photos. Supports GPT Image 2 up to 16 images, Qwen up to 3, and Krea 2 Identity Edit with 1-2. This is the required tool for identity-sensitive edits of a referenced person or character: wardrobe, makeover, pose/repositioning, face/head/body changes, background or lighting changes, character-consistent style transfer, persona scene creation, and non-Pro single-character sheets. Use model="krea-identity-edit" for those by default unless the user explicitly names another model. Keep the primary base/scene image first and an optional person/detail reference second. Use this instead of generate_image whenever uploaded/persona assets must guide the result. Use restore_photo/refine_result/apply_style only for identity-neutral restoration or edits; a portrait follow-up that must preserve likeness stays on edit_image. Exception: explicit Z-image/Z-image Turbo/base Krea 2 Turbo img2img uses generate_image with sourceImageIndex and starting_image_strength.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: `Edit instruction describing what to generate using the reference images as guidance. 50-200 words recommended.

${LITERAL_PROMPT_OVERRIDE}

PROMPT CONSTRUCTION ORDER — build the prompt in this sequence:
1. IDENTITY LOCK — state which picture owns the person's identity (GOLDEN RULE: never leave identity ambiguous when editing a person)
2. REQUESTED EDIT — describe only what CHANGES (the delta), not the whole image
3. REFERENCE ROLE MAPPING — assign each picture ONE primary role: base_identity (face/person), pose_reference, outfit_reference, style_reference, background_reference, or color_reference
4. POSE / COMPOSITION — pose, framing, camera angle (omit if unchanged)
5. STYLE — artistic style, genre, era (omit if unchanged)
6. LIGHTING / REALISM — "maintain realistic anatomy, perspective, and lighting integration"
7. PRESERVE clause — always end with "preserve all unmentioned details"

IDENTITY LOCK (required when a person is in any reference image):
"Preserve the exact facial likeness from picture N — face structure, eye shape, nose shape, mouth shape, jawline, skin tone, hairline, apparent age, and overall recognizability."
Never let a style, pose, or clothing reference silently override the face. If multiple images are provided, explicitly state "identity comes only from picture N — do not borrow identity from other pictures."

MINIMAL-CHANGE PRINCIPLE: The base image already contains the subject, composition, camera angle, expression, lighting, and background. Describe only the delta. Use positive constraints ("preserve exact facial likeness") not negative ones ("don't change the face").

SINGLE-IMAGE PATTERN:
"Preserve the exact facial likeness and recognizability of the person from picture 1. [Describe only the requested change]. Keep the same pose, framing, camera angle, and expression unless the user specifically requests changes to these. Preserve all unmentioned details."

MULTI-IMAGE PATTERN:
"Use the person from picture 1 as the final subject and preserve their exact facial likeness. [Requested edit]. Identity comes only from picture 1. Pose from picture 2. Outfit from picture 3. Do not borrow identity from pictures 2 or 3. Maintain realistic anatomy, perspective, and lighting integration. Preserve all unmentioned details."

KREA IDENTITY EDIT: Use model="krea-identity-edit" whenever an edit of a referenced person or character must keep likeness or character identity while changing clothes, hair or makeup, pose or position, face/head/body, background, lighting, or visual style. Infer that semantic intent in any language; never route from keyword or regex matching. Also use it for a single-character sheet in non-Pro mode. This semantic default applies even when the user did not name Krea; an explicitly user-requested model always wins. Use model="dark-beast-krea2-identity-edit" only when the user explicitly requests Dark Beast Krea 2 Identity Edit, its community/uncensored variant, or the dark_beast_krea2_identity_edit_v1_2 model id. These models require one reference image, accept up to two context images, work best at 512-2048 px, let the model tier and worker choose their current execution defaults, and do not use negative prompts. Put the primary scene/base image first and the person/detail reference second for scene-plus-person edits; reference them with context_image_0 and context_image_1 when model_ref tokens are needed.

KREA 2 IDENTITY EDIT PROMPTING: Krea performs best with a concise, direct delta instruction rather than a generic 50-200 word expansion. For one reference, state the requested change in 1-4 concrete sentences and name only the details that must remain fixed; avoid restating the entire image or dumping a long facial-feature inventory. For two references, explicitly assign roles in a compact instruction: base scene/image first, person/detail/outfit/pose/style reference second. Use sourceImageIndex to make the base scene the first context image when uploads arrive in another order (-1 = first upload, -2 = second). End with a short preservation clause only when useful. Longer structured prompts remain appropriate for character sheets, grids, editorial layouts, or exact visible text.

CREATIVE TRANSFORMATIONS — be vivid and reference-specific, name the artist, franchise, or era, but always anchor identity first:
  - "Preserve the exact facial likeness from picture 1. Transform them into a Renaissance oil painting in the style of Vermeer — rich warm tones, dramatic chiaroscuro lighting, ornate period clothing. Maintain realistic anatomy. Preserve all unmentioned details."
  - "Preserve the exact facial likeness from picture 1. Reimagine them as a Marvel superhero — cinematic dramatic lighting, heroic pose, detailed costume with cape, glowing energy effects. Preserve all unmentioned details."
  - "Preserve the exact facial likeness from picture 1. Transform them into a Studio Ghibli anime character — soft watercolor backgrounds, gentle Ghibli-style rendering, whimsical atmosphere. Preserve all unmentioned details."
  - "Preserve the exact facial likeness from picture 1. Place them into a Star Wars scene — Jedi robes, lightsaber glow, dramatic sci-fi backdrop. Preserve all unmentioned details."
  - "Preserve the exact facial likeness from picture 1. Turn them into a GTA loading screen character — bold outlines, saturated colors, attitude-filled pose, urban backdrop. Preserve all unmentioned details."

FAILURE MODES TO AVOID:
- Face drift: identity source not specified, or style/pose reference overrides the face
- Over-editing: for simple edits, prompt rewrites the entire image instead of describing the delta (creative transformations may intentionally change more)
- Reference confusion: multiple images provided without explicit role mapping

CHARACTER / MASCOT SHEETS: When the user asks for a character sheet, mascot sheet, model sheet, turnaround, expression sheet, or reusable character reference board using uploaded references, create ONE comprehensive professional reference-board image, not separate variations. Map reference roles clearly first (for example: picture 1 = character identity/style reference, picture 2 = logo/brand asset) and keep the character identity consistent across every panel. Include a large hero pose, front / 3/4 / side / back turnaround views, an expression row, action/personality poses, accessories or props, color palette swatches, and compact notes such as personality, fun facts, or brand usage when appropriate. Preserve exact user-provided brand names, slogans, logo text, and requested copy verbatim; incidental tiny notes may be generated by the image model if the user did not provide exact wording. Use clean readable typography.

BATCH VARIATIONS: When numberOfVariations > 1, the prompt describes one output image. Do not mention counts, "versions", "different", or "multiple" in the prompt text unless the user explicitly wants those words visible in the image. Do not describe multiple copies or duplicates of the subject in a single image unless the user asked for a grid, collage, or side-by-side composition. Use Dynamic Prompt syntax to vary one dimension across separate images. For personas: vary scene, activity, expression, or environment; preserve identity. Example: user asks "4 versions at the beach" → numberOfVariations=4, prompt="[persona] at the beach {building a sandcastle|surfing a wave|reading under a palm tree|flying a kite}" — each output is one person doing one activity. For direct edits: vary the approach, e.g., numberOfVariations=3, prompt="make the sky {a vibrant sunset|stormy and dramatic|clear blue}". Preserve any requested orientation, aspect ratio, or exact pixel dimensions across every variation.

SELECTION-GATED IMAGE STAGES: If the user asks for multiple reference-guided image options/takes/versions and says they will pick one before a later dance, animation, or video, this edit_image call is still the first step. Generate the complete image batch now with sourceImageIndex set to the relevant reference, the exact requested count, Dynamic Prompt options for each output, and the final video/image aspect ratio. Do not ask the user to choose before the images exist, and do not call video tools until after the user selects an image.

LINKED VARIANTS: If multiple details must stay paired per output — visual style, identity cues, outfit, label text, symbols, setting, character, prop, location, or before/after keyframe details — use ONE top-level Dynamic Prompt branch with one complete prompt per output. Do NOT use separate Dynamic Prompt groups for details that must stay together; unpaired groups can mix attributes. If the user asks for per-variant facial, identity, or appearance changes, repeat that guidance inside EVERY option while also preserving recognizability. When the user names a subject or character, write that name or stable role inside every Dynamic Prompt option; a shared prefix outside the branch is not enough because each option must stand alone as a complete identity contract.

Each option must be a fully concrete description — name the actual garment or styling, the actual setting, the actual accessories, and the literal text or symbol shown on screen when requested. Never use meta-placeholder phrasing such as "style-specific outfit", "variant-specific background", "include the requested symbol", "include a humorous alternate name", or "bake the name and symbol into the image" — those describe the task instead of the image.

ORIGINAL + VARIANT BATCHES: When one option is a remade/preserved original and the other options are themed variants, the original option still needs a concrete visual contract. Say to preserve the original clothing/wardrobe/outfit and original background/setting, then name any requested added text, label, flag, logo, symbol, or prop for that original option. Do not leave the original option as only "unmodified original person"; it must be as fully specified as every themed option.

NEW SETTING PER OPTION: When the variant theme implies a new place, culture, era, or context, every option must name its own setting (location, props, lighting). Do NOT carry the source background forward, do NOT write "in the same pose and placement as the original photo" without also naming the new background, and do NOT rely on "preserve all unmentioned details" to handle the setting — the new setting IS a mentioned detail.

RECOGNIZABILITY OVER FEATURE LOCK: For ethnic / age / character / art-style transformations, do NOT paste the strict IDENTITY LOCK feature list ("face structure, eye shape, nose shape, mouth shape, jawline, skin tone, hairline") inside each option — that list contradicts the requested face change and the source face will pass through unchanged. Anchor recognizability per option through apparent age, signature hair silhouette, build, posture, and expression, and explicitly allow skin tone, facial features, and proportions to shift toward the target.

Correct shape (each option self-contained, concrete, with a fresh setting and a recognizability anchor instead of a strict feature lock):
"{The subject wearing [specific garment, color, cut, and material], standing in [specific NEW setting with props and lighting — never the source background], bold text at the bottom reads [literal requested text], [specific requested visual symbol] appears as a sign or prop, [requested per-variant facial or appearance shift, e.g. "skin tone, eye shape, and bone structure shift toward <target> features"], recognizable through apparent age, signature hair silhouette, build, posture, and expression|The subject wearing [second specific garment, color, cut, and material], standing in [second specific NEW setting with props and lighting], bold text at the bottom reads [second literal requested text], [second requested visual symbol] appears as a sign or prop, [second requested facial or appearance shift], recognizable through apparent age, signature hair silhouette, build, posture, and expression|...}"

Wrong shape (placeholder labels masquerading as prompts):
"{First variant with variant-specific facial features, placeholder wardrobe, alternate name, and requested symbol baked in|Second variant with different variant-specific facial features, placeholder wardrobe, alternate name, and requested symbol baked in|...}"

Also wrong (strict feature lock + no new setting — the source face and source background pass through unchanged):
"{Preserve the exact facial likeness — face structure, eye shape, nose shape, mouth shape, jawline, skin tone, hairline. Reimagine as <variant>: [garment description], standing in the exact same pose and placement as the original photo. Preserve all unmentioned details.|Preserve the exact facial likeness — [same strict lock]. Reimagine as <other variant>: [other garment], standing in the exact same pose and placement as the original photo. Preserve all unmentioned details.|...}"

SCREENPLAY / STORYBOARD BATCHES: For multi-scene story, commercial, or longer-form video keyframes, use one Dynamic Prompt branch with one full scene prompt per option. Recurring characters must keep stable names and repeated visual anchors in every scene option where they appear: face/identity source if available, age range, build, hairstyle, outfit silhouette, color palette, signature prop/accessory, posture, and role. Do not let style, scene changes, or pose references alter identity. Include screenplay-style speaker tags when dialogue matters, e.g. CHARACTER: "We made it."

COMPOSITE GPT IMAGE 2 STORYBOARD SHEETS: When numberOfVariations=1 and the user asks for one composite video storyboard/keyframe sheet using uploaded or generated references, the prompt must be a compiled storyboard prompt, not a concept summary. Include a SCENES: section with exactly the requested number of concrete entries named SCENE_01, SCENE_02, etc. Every scene entry must include Visual/Action, Camera/Motion, Dialogue/VO (or [no dialogue]), Audio/SFX, and any visible text or reference usage for that scene. Do not provide only the source brief or generic layout instructions; malformed compiled storyboard prompts are blocked by quality audit.`,
        },
        model: {
          type: 'string',
          enum: [
            'gpt-image-2',
            'gpt-image-2.5-sunburst',
            'gpt-image-2.5-flare',
            'qwen-lightning',
            'qwen',
            'krea-identity-edit',
            'dark-beast-krea2-identity-edit',
          ],
          description:
            'The app auto-selects Fast→Qwen Lightning and HQ/Pro→full Qwen for ordinary identity-neutral edits. REQUIRED IDENTITY DEFAULT: set "krea-identity-edit" (Krea 2 Identity Edit LoRA v1.2) whenever an edit of a referenced person or character must keep likeness or character identity while changing clothes, hair or makeup, pose or position, face/head/body, background, lighting, or visual style. Infer that semantic intent in any language; never route from keyword or regex matching. Also use it for a single-character sheet in non-Pro mode. This semantic default applies even when the user did not name Krea; an explicitly user-requested model always wins. Set "dark-beast-krea2-identity-edit" only when the user explicitly asks for Dark Beast Krea 2 Identity Edit, its uncensored/community variant, or dark_beast_krea2_identity_edit_v1_2. Set "gpt-image-2" when the user explicitly names GPT/OpenAI/ChatGPT Image, or when precise typography, dense labels, or a professional multi-panel layout is the primary requirement; Pro character sheets may retain GPT Image 2. If GPT Image 2 is unavailable for detail-critical layout work, fall back to full "qwen", never "qwen-lightning". Krea identity edit models require at least one reference image, accept up to two context images, and work best at 512-2048px. Let the model tier and worker choose their current steps, guidance, sampler, scheduler, grounding, and reference-boost defaults; do not send a negative prompt. Put the base scene/image first and a person/detail reference second. Z-image, Z-image Turbo, and base Krea 2 Turbo are generate_image img2img models, not edit_image selectors. If the user names another edit/image model, honor it. GPT Image 2 always processes input images at high fidelity; do not set input_fidelity. GPT Image 2.5 adds two distinct models: use "gpt-image-2.5-sunburst" for an explicit Sunburst request and "gpt-image-2.5-flare" for an explicit Flare request. For GPT Image 2.5 without a named variant, use Flare. Preserve explicit GPT Image 2.0 as "gpt-image-2". Sunburst is positioned for difficult images and precise edits; Flare for faster everyday generation. Both generate and edit. Model choice is independent of rendering quality.',
        },
        sourceImageIndex: {
          type: 'number',
          description:
            'Index of the primary image to use as the main reference. For follow-up edits when generated image results already exist, use the 0-based generated image result index; for example, editing the latest generated storyboard/image should use that generated result index so the model modifies the existing image instead of redrawing from uploads. When no generated image results exist, use sourceImageIndex=-1 to use the uploaded image references. The primary image and any additional uploaded images are passed as context images to guide generation.',
        },
        loras: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          items: { type: 'string', minLength: 1 },
          description: `Ordered LoRA IDs for the edit. ONLY valid with model="krea-identity-edit" or model="dark-beast-krea2-identity-edit" — Qwen and GPT Image 2 accept no LoRAs and the IDs are dropped. Use when the user asks to shift a trait the identity edit itself does not change, such as age, build, skin, lighting or grain, while the identity LoRA holds the likeness. ${LORA_STACKING_GUIDANCE}

${KREA2_LORA_CATALOG_REFERENCE}`,
        },
        loraStrengths: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          items: { type: 'number' },
          description: LORA_STRENGTHS_GUIDANCE,
        },
        numberOfVariations: {
          type: 'number',
          description:
            'Number of variations (1-16). Pass the user\'s exact requested count in one call when the outputs can share project settings. "4 variations" → numberOfVariations=4 in a single call. Use the exact requested count for reference-guided images that will feed a later video after the user picks one. Use separate calls only when the user explicitly wants independent projects, isolated approvals, or per-output settings that cannot share one project. For screenplay/storyboard batches, the prompt should contain one Dynamic Prompt branch with one full scene prompt per scene; do not set numberOfVariations=N with only scene 1\'s prompt. Use 1 unless the user explicitly asks for multiple. Default: 1.',
          minimum: 1,
          maximum: 16,
        },
        width: {
          type: 'number',
          description:
            'Output image width in pixels. Defaults to the context image width. Supported bounds depend on the selected edit model: Qwen edit models support 256-2560 on either edge; Krea 2 Identity Edit and Dark Beast Krea 2 Identity Edit work best from 512-2048 on either edge; GPT Image 2 supports flexible dimensions up to 3840px on either edge with max 3:1 aspect ratio and a total pixel budget from 655,360 to 8,294,400. Set when the user specifies a width, exact pixel dimensions, or a named resolution (e.g., "1280 wide", "1280x720", "720p", "3840x2160"). If the user gives only one dimension, set only that dimension and preserve/infer the sensible aspect ratio. User-requested dimensions override the default media quality, including Pro. Non-multiple-of-16 values are accepted when in bounds; the renderer snaps to the nearest supported size internally, so do not ask the user to adjust by a few pixels.',
        },
        height: {
          type: 'number',
          description:
            'Output image height in pixels. Defaults to the context image height. Supported bounds depend on the selected edit model: Qwen edit models support 256-2560 on either edge; Krea 2 Identity Edit and Dark Beast Krea 2 Identity Edit work best from 512-2048 on either edge; GPT Image 2 supports flexible dimensions up to 3840px on either edge with max 3:1 aspect ratio and a total pixel budget from 655,360 to 8,294,400. Set when the user specifies a height, exact pixel dimensions, or a named resolution (e.g., "720 high", "1280x720", "720p", "2160x3840"). If the user gives only one dimension, set only that dimension and preserve/infer the sensible aspect ratio. User-requested dimensions override the default media quality, including Pro. Non-multiple-of-16 values are accepted when in bounds; the renderer snaps to the nearest supported size internally, so do not ask the user to adjust by a few pixels.',
        },
        aspectRatio: {
          type: 'string',
          description:
            `${ASPECT_RATIO_DESCRIPTION}\n\nSet this whenever the user specifies an image or downstream video orientation/aspect ratio such as 9:16, 16:9, portrait, vertical, landscape, widescreen, TikTok/Reels/Shorts, or exact pixels. This includes selection-gated reference-guided image batches that will feed a later video or dance after the user picks one. For GPT Image 2 exact size requests, preserve exact pixel intent when possible and prefer popular GPT sizes such as 1536x1024, 1024x1536, 2048x1152, 3840x2160, and 2160x3840. Sogni does not expose transparent output for GPT Image 2.0. For transparent assets, select GPT Image 2.5 Sunburst or Flare with gptImageBackground=transparent and PNG or WebP output.`,
        },
        gptImageQuality: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'xhigh', 'max'],
          description:
            'Optional GPT Image rendering quality. Only set it when the user explicitly asks for low/fast, medium/balanced, high/final, xhigh/extra high, or max/maximum quality; xhigh and max require GPT Image 2.5 Sunburst or Flare. Provider-chosen (auto) quality is never used. Otherwise omit it and let the host app media quality setting map Fast to low, HQ to medium, and Pro to high. The same quality label does not promise equivalent results across models.',
        },
        mask_image_url: {
          type: 'string',
          description:
            'Optional GPT Image edit mask URL or inline data:image/png;base64 URI. Requires a PNG alpha mask matching the first source reference dimensions; the source itself may be JPEG, PNG or WebP. Transparent mask regions identify edits; opaque regions are preserved as guidance. With multiple references the mask applies only to the first image.',
        },
        gptImageBackground: {
          type: 'string',
          enum: ['auto', 'opaque', 'transparent'],
          description: 'GPT Image background: auto or opaque; transparent is supported by GPT Image 2.5 Sunburst and Flare with PNG or WebP output. JPEG cannot preserve transparency.',
        },
        gptImageOutputCompression: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Optional GPT Image JPEG/WebP output compression, from 0 to 100. Omit for PNG.',
        },
        outputFormat: {
          type: 'string',
          enum: ['png', 'jpg', 'jpeg', 'webp'],
          description:
            'Optional output file format for generated images. Set only when the user explicitly requests PNG, JPG/JPEG, or WebP. Hosts should normalize "jpeg" to the Sogni project format "jpg".',
        },
        personaName: {
          type: 'string',
          description:
            'RARE — only set this when the user EXPLICITLY asks for solo images of one specific person ("a portrait of just [name]", "4 solos of [name] alone"). When set, the handler filters context to ONLY that persona\'s reference photo, so any other personas in your prompt will be missing their reference. DEFAULT for multi-persona requests is to OMIT this and put both faces in one combined call. Never set this for "make us as X", "the two of us", "my wife and I", or any phrasing that puts both personas in the same scene — that\'s a single combined call with no personaName.',
        },
      },
      required: ['prompt'],
    },
  },
};
