/**
 * Phase 3 gating-policy data shared across consumers.
 *
 * Promoted from sogni-chat (was `src/services/contractsPolicies.ts`) into
 * the shared package so hosted chat (`sogni-api` /v1/chat/completions
 * + /v1/creative-agent/workflows), the standalone skill artifact, and
 * future SDK consumers can dispatch against the same gating rules
 * without re-implementing them.
 *
 * Media-routing policies cover. Expensive media-routing gates require planner/runtime
 * signal provenance so regex/classifier facts can remain advisory:
 *   - DIAGNOSTIC_REQUEST            forbid media when answering errors
 *   - GENERATION_DETAILS_QUERY      forbid media when answering "what model/seed/etc"
 *   - TEXT_ONLY_REQUEST             forbid media when user wants text
 *   - DIAGNOSTIC_COMPLAINT          forbid media when user complains about prior output
 *   - UPLOADED_BASE_VIDEO_PRESENT   prevent fresh renders when modifying an upload
 *   - UPLOADED_BASE_VIDEO_EXTEND    force extend for uploaded-video extension
 *   - UPLOADED_BASE_VIDEO_REPLACE   force segment replacement for uploaded-video replacement
 *   - UPLOADED_BASE_VIDEO_OVERLAY   force overlay for uploaded-video overlays
 *   - UPLOADED_BASE_VIDEO_SUBTITLES force subtitles for uploaded-video captions
 *   - UPLOADED_BASE_VIDEO_TRANSFORM force video_to_video for uploaded-video transforms
 *   - UPLOADED_BASE_VIDEO_STITCH    force stitch_video for uploaded-video stitching
 *   - UPLOADED_BASE_VIDEO_UPSCALE   force upscale_video for uploaded-video resolution upscales
 *   - HAS_PERSONA_AND_REQUESTS_VIDEO  require resolve_personas + edit_image first only when persona is explicit
 *   - HAS_PERSONA_AND_REQUESTS_PERSONA_IMAGE  require edit_image (not generate_image)
 */

import type { ContractRegistry } from '../registry.js';
import type { ToolGatingPolicy } from '../toolGatingPolicy.js';

/**
 * Tool names that count as "media generation" tools — anything that
 * would invoke a worker, consume credits, or render content. The
 * forbid-all-media gates (DIAGNOSTIC_REQUEST etc.) use this list as
 * their forbid effect.
 *
 * Kept inline so the policy definitions stay portable and the list
 * does not silently change shape if a consumer's tool registry drifts.
 */
export const MEDIA_TOOL_NAMES: ReadonlyArray<string> = [
  'generate_image',
  'edit_image',
  'restore_photo',
  'upscale_image',
  'apply_style',
  'refine_result',
  'animate_photo',
  'change_angle',
  'generate_video',
  'sound_to_video',
  'video_to_video',
  'upscale_video',
  'generate_music',
  'generate_speech',
  'extend_video',
  'replace_video_segment',
  'overlay_video',
  'add_subtitles',
  'stitch_video',
  'orbit_video',
  'dance_montage',
];

export const GATING_POLICIES: ReadonlyArray<ToolGatingPolicy> = [
  {
    policyId: 'DIAGNOSTIC_REQUEST',
    version: '1.0.0',
    trigger: { allOf: ['asks_about_previous_error', 'has_prior_generation_context'] },
    effect: { forbid: [...MEDIA_TOOL_NAMES] },
    rationale:
      'The latest user message asks about a previous error. Do not retry media; ' +
      'answer from prior tool calls and context.',
  },
  {
    policyId: 'GENERATION_DETAILS_QUERY',
    version: '1.0.0',
    trigger: { allOf: ['asks_about_generation_details', 'has_prior_generation_context'] },
    effect: { forbid: [...MEDIA_TOOL_NAMES] },
    rationale:
      'The latest user message asks about prior generation details. Do not create ' +
      'or retry media; answer only from prior tool calls.',
  },
  {
    policyId: 'TEXT_ONLY_REQUEST',
    version: '1.0.0',
    trigger: { allOf: ['requests_text_only_response'] },
    effect: { forbid: [...MEDIA_TOOL_NAMES] },
    rationale:
      'The latest user message requests a text-only response. Do not call any ' +
      'media generation tools.',
  },
  {
    policyId: 'DIAGNOSTIC_COMPLAINT',
    version: '1.0.0',
    trigger: { allOf: ['requests_diagnostic_response', 'has_prior_generation_context'] },
    effect: { forbid: [...MEDIA_TOOL_NAMES] },
    rationale:
      'The latest user message is a diagnostic complaint about prior output. Do not ' +
      'create or retry media; explain what likely went wrong.',
  },
  {
    policyId: 'UPLOADED_BASE_VIDEO_PRESENT',
    version: '1.0.0',
    trigger: {
      allOf: ['has_uploaded_video', 'requests_video_modification'],
      sources: {
        has_uploaded_video: 'session_state',
        requests_video_modification: 'planner',
      },
    },
    effect: {
      forbid: ['generate_video', 'animate_photo'],
    },
    rationale:
      'A user-uploaded video is the base; modify that asset directly instead ' +
      'of rendering a fresh clip.',
  },
  {
    policyId: 'UPLOADED_BASE_VIDEO_EXTEND',
    version: '1.0.0',
    trigger: {
      allOf: ['has_uploaded_video', 'video_modification:extend'],
      sources: {
        has_uploaded_video: 'session_state',
        'video_modification:extend': 'planner',
      },
    },
    effect: {
      forbid: ['generate_video', 'animate_photo'],
      require: ['extend_video'],
    },
    rationale:
      'The planner identified uploaded-video extension. Use extend_video on the ' +
      'uploaded base; do not create a separate fresh clip.',
  },
  {
    policyId: 'UPLOADED_BASE_VIDEO_REPLACE',
    version: '1.0.0',
    trigger: {
      allOf: ['has_uploaded_video', 'video_modification:replace_segment'],
      sources: {
        has_uploaded_video: 'session_state',
        'video_modification:replace_segment': 'planner',
      },
    },
    effect: {
      forbid: ['generate_video', 'animate_photo'],
      require: ['replace_video_segment'],
    },
    rationale:
      'The planner identified an uploaded-video segment replacement. Use ' +
      'replace_video_segment on the uploaded base.',
  },
  {
    policyId: 'UPLOADED_BASE_VIDEO_OVERLAY',
    version: '1.0.0',
    trigger: {
      allOf: ['has_uploaded_video', 'video_modification:overlay'],
      sources: {
        has_uploaded_video: 'session_state',
        'video_modification:overlay': 'planner',
      },
    },
    effect: {
      forbid: ['generate_video', 'animate_photo'],
      require: ['overlay_video'],
    },
    rationale:
      'The planner identified an uploaded-video overlay. Use overlay_video on ' +
      'the uploaded base.',
  },
  {
    policyId: 'UPLOADED_BASE_VIDEO_SUBTITLES',
    version: '1.0.0',
    trigger: {
      allOf: ['has_uploaded_video', 'video_modification:subtitles'],
      sources: {
        has_uploaded_video: 'session_state',
        'video_modification:subtitles': 'planner',
      },
    },
    effect: {
      forbid: ['generate_video', 'animate_photo'],
      require: ['add_subtitles'],
    },
    rationale:
      'The planner identified uploaded-video subtitles. Use add_subtitles on ' +
      'the uploaded base.',
  },
  {
    policyId: 'UPLOADED_BASE_VIDEO_TRANSFORM',
    version: '1.0.0',
    trigger: {
      allOf: ['has_uploaded_video', 'video_modification:transform'],
      sources: {
        has_uploaded_video: 'session_state',
        'video_modification:transform': 'planner',
      },
    },
    effect: {
      forbid: ['generate_video', 'animate_photo'],
      require: ['video_to_video'],
    },
    rationale:
      'The planner identified an uploaded-video transform. Use video_to_video ' +
      'on the uploaded base.',
  },
  {
    policyId: 'UPLOADED_BASE_VIDEO_STITCH',
    version: '1.0.0',
    trigger: {
      allOf: ['has_uploaded_video', 'video_modification:stitch'],
      sources: {
        has_uploaded_video: 'session_state',
        'video_modification:stitch': 'planner',
      },
    },
    effect: {
      forbid: ['generate_video', 'animate_photo'],
      require: ['stitch_video'],
    },
    rationale:
      'The planner identified uploaded-video stitching. Use stitch_video with ' +
      'the uploaded clips instead of rendering a fresh clip.',
  },
  {
    policyId: 'UPLOADED_BASE_VIDEO_UPSCALE',
    version: '1.0.0',
    trigger: {
      allOf: ['has_uploaded_video', 'video_modification:upscale'],
      sources: {
        has_uploaded_video: 'session_state',
        'video_modification:upscale': 'planner',
      },
    },
    effect: {
      forbid: ['generate_video', 'animate_photo', 'video_to_video'],
      require: ['upscale_video'],
    },
    rationale:
      'The planner identified a pure resolution upscale of the uploaded video. Use ' +
      'the promptless upscale_video tool; do not re-render the clip with a generative model.',
  },
  {
    policyId: 'HAS_PERSONA_AND_REQUESTS_VIDEO',
    version: '1.0.0',
    trigger: {
      allOf: [
        'has_active_persona',
        'requests_persona_video_generation',
        'no_persona_image_in_session',
      ],
      sources: {
        has_active_persona: 'session_state',
        requests_persona_video_generation: 'planner',
        no_persona_image_in_session: 'session_state',
      },
    },
    effect: { forbid: [], require: ['resolve_personas', 'edit_image'] },
    rationale:
      'Persona videos require an image stage first: resolve_personas, then ' +
      'edit_image to render the persona, then animate. Do not go text-to-video.',
  },
  {
    policyId: 'HAS_PERSONA_AND_REQUESTS_PERSONA_IMAGE',
    version: '1.0.0',
    trigger: {
      allOf: ['has_active_persona', 'requests_persona_image_generation'],
      sources: {
        has_active_persona: 'session_state',
        requests_persona_image_generation: 'planner',
      },
    },
    effect: {
      forbid: ['generate_image'],
      require: ['edit_image'],
    },
    rationale:
      'Persona images must use edit_image with the persona reference photo, ' +
      'never generate_image (which has no access to the persona identity).',
  },
];

/**
 * Populate a ContractRegistry with the default gating policies.
 * Idempotent — registering the same policyId twice overwrites the
 * prior entry because ContractRegistry uses a Map keyed on policyId.
 */
export function populateContractsGatingPolicies(registry: ContractRegistry): void {
  for (const policy of GATING_POLICIES) {
    registry.registerGatingPolicy(policy);
  }
}
