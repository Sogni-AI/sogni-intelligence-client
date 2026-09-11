/**
 * Unit tests for the promptless FlashVSR video-upscale contract: the
 * upscale_video tool definition, its routing/cost/gating data, and the shared
 * output-geometry helpers in src/media/videoUpscale.ts.
 *
 * The geometry must match the server's derivation exactly (short edge scaled to
 * the target, both edges rounded to even pixels), because the server rejects a
 * request whose output size differs from the size it derives from the source.
 */
import { FLASHVSR_VIDEO_UPSCALE_MODEL_ID } from '@sogni-ai/sogni-client';
import {
  VIDEO_UPSCALE_MODEL_ID,
  VIDEO_UPSCALE_SOURCE_LIMITS,
  VIDEO_UPSCALE_TARGET_RESOLUTIONS,
  VideoUpscaleRequestError,
  defaultVideoUpscaleResolution,
  resolveVideoUpscaleOutput,
  validateVideoUpscaleSourceTiming,
} from '../src/media/index.js';
import {
  MODELS_BY_TOOL,
  generationToolDefinitions,
  upscaleVideoDefinition,
  videoToVideoDefinition,
} from '../src/tools/index.js';
import {
  BACKBONE_GENERATION_TOOL_NAMES,
  GATING_POLICIES,
  MEDIA_TOOL_NAMES,
  PROMPT_CONTRACTS,
  REPAIR_RECIPES,
  TOOL_COST_METADATA,
  VIDEO_CONTEXT_TOOL_NAMES,
  getToolPermission,
} from '../src/contracts/index.js';
import { VIDEO_EDITING_SKILL } from '../src/public-skill-runtime/index.js';
import { validateProjectConfig } from '../src/utils/helpers.js';

let testsPassed = 0;
let testsFailed = 0;

function expect<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`✅ PASS: ${label}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${label}`);
    console.error(`   expected: ${JSON.stringify(expected)}`);
    console.error(`   actual:   ${JSON.stringify(actual)}`);
    testsFailed++;
  }
}

function errorMessage(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (!(error instanceof VideoUpscaleRequestError)) return `unexpected ${String(error)}`;
    return error.message;
  }
}

export function runVideoUpscaleTests(): { passed: number; failed: number } {
  console.log('\n🧪 upscale_video — FlashVSR video upscale contract\n');

  // --- tool definition -------------------------------------------------------
  const fn = upscaleVideoDefinition.function;
  const properties = (fn.parameters?.properties ?? {}) as Record<string, { enum?: number[]; type?: string }>;
  expect('tool name', fn.name, 'upscale_video');
  expect('promptless: exposes only source selection and resolution', Object.keys(properties).sort(), [
    'sourceVideoIndex',
    'targetResolution',
  ]);
  expect('no required arguments', fn.parameters?.required, []);
  expect('resolution enum is 1080/1440', properties.targetResolution?.enum, [1080, 1440]);
  expect('resolution enum matches media constant', properties.targetResolution?.enum, [
    ...VIDEO_UPSCALE_TARGET_RESOLUTIONS,
  ]);
  expect(
    'description names FlashVSR and the preserved properties',
    ['FlashVSR', 'every source frame', 'original audio', 'video_to_video'].every((term) =>
      String(fn.description).includes(term),
    ),
    true,
  );
  expect(
    'description and prompt contract explain the 4K limit',
    String(fn.description).includes('cannot produce 4K')
      && Boolean(PROMPT_CONTRACTS.find((candidate) => candidate.toolName === 'upscale_video')?.baseDescription.includes('cannot produce 4K')),
    true,
  );
  const upscaleContractText = String(
    PROMPT_CONTRACTS.find((candidate) => candidate.toolName === 'upscale_video')?.baseDescription,
  );
  expect(
    'description and prompt contract leave the clip-length limit to the server',
    [String(fn.description), upscaleContractText].every((text) =>
      text.includes('The server sets the maximum clip length')
        && text.includes('never quote a length limit yourself')
        && !/\b\d+ frames\b|\babout \d+ seconds\b/.test(text),
    ),
    true,
  );
  expect(
    'registered as a generation tool',
    generationToolDefinitions.some((definition) => definition.function.name === 'upscale_video'),
    true,
  );
  expect(
    'video_to_video points pure upscales at upscale_video',
    String(videoToVideoDefinition.function.description).includes('use upscale_video instead'),
    true,
  );
  expect('model registry lists FlashVSR', MODELS_BY_TOOL.upscale_video, [
    { key: 'flashvsr', displayName: 'FlashVSR v1.1' },
  ]);
  expect('model id matches the SDK constant', VIDEO_UPSCALE_MODEL_ID, FLASHVSR_VIDEO_UPSCALE_MODEL_ID);

  // --- contract data ---------------------------------------------------------
  const contract = PROMPT_CONTRACTS.find((candidate) => candidate.toolName === 'upscale_video');
  expect('prompt contract registered', contract?.contractId, 'upscale_video_v1');
  expect(
    'prompt contract documents both parameters',
    Object.keys(contract?.parameterDocs ?? {}).sort(),
    ['sourceVideoIndex', 'targetResolution'],
  );
  expect(
    'prompt contract keeps Seedance re-renders on video_to_video',
    Boolean(contract?.baseDescription.includes('Use video_to_video only when the user explicitly names')),
    true,
  );
  const v2vContract = PROMPT_CONTRACTS.find((candidate) => candidate.toolName === 'video_to_video');
  expect(
    'video_to_video contract no longer claims generic upscaling',
    Boolean(v2vContract?.baseDescription.includes('use upscale_video instead')),
    true,
  );
  const cost = TOOL_COST_METADATA.find((entry) => entry.tool === 'upscale_video');
  expect('cost metadata is paid video work', [cost?.costClass, cost?.riskLevel], ['video.standard', 'paid']);
  expect('paid tool requires user approval', getToolPermission('upscale_video')?.decision, 'require_user_approval');
  expect('counts as a media tool', MEDIA_TOOL_NAMES.includes('upscale_video'), true);
  expect('locked until a video is in scope', VIDEO_CONTEXT_TOOL_NAMES.includes('upscale_video'), true);
  expect(
    'durable/backbone generation tool',
    (BACKBONE_GENERATION_TOOL_NAMES as readonly string[]).includes('upscale_video'),
    true,
  );
  expect(
    'repair recipes cover the tool',
    REPAIR_RECIPES.filter((recipe) => recipe.toolName === 'upscale_video').length > 0,
    true,
  );
  const upscalePolicy = GATING_POLICIES.find((policy) => policy.policyId === 'UPLOADED_BASE_VIDEO_UPSCALE');
  expect('uploaded-video upscale policy requires upscale_video', upscalePolicy?.effect.require, ['upscale_video']);
  expect(
    'uploaded-video upscale policy forbids generative re-renders',
    upscalePolicy?.effect.forbid,
    ['generate_video', 'animate_photo', 'video_to_video'],
  );
  expect(
    'uploaded-video upscale policy needs planner provenance',
    upscalePolicy?.trigger.sources?.['video_modification:upscale'],
    'planner',
  );
  expect('public video-editing skill exposes the tool', VIDEO_EDITING_SKILL.toolNames.includes('upscale_video'), true);

  // --- output geometry -------------------------------------------------------
  expect(
    '720p landscape defaults to 1440p',
    resolveVideoUpscaleOutput({ sourceWidth: 1280, sourceHeight: 720 }),
    { resolution: 1440, width: 2560, height: 1440 },
  );
  expect(
    '720p landscape at 1080p',
    resolveVideoUpscaleOutput({ sourceWidth: 1280, sourceHeight: 720, targetResolution: 1080 }),
    { resolution: 1080, width: 1920, height: 1080 },
  );
  expect(
    'portrait keeps its orientation',
    resolveVideoUpscaleOutput({ sourceWidth: 720, sourceHeight: 1280 }),
    { resolution: 1440, width: 1440, height: 2560 },
  );
  expect(
    'MiniMax H3 768p at 1440p rounds to even pixels',
    resolveVideoUpscaleOutput({ sourceWidth: 1344, sourceHeight: 768 }),
    { resolution: 1440, width: 2520, height: 1440 },
  );
  expect(
    'MiniMax H3 768p at 1080p',
    resolveVideoUpscaleOutput({ sourceWidth: 1344, sourceHeight: 768, targetResolution: 1080 }),
    { resolution: 1080, width: 1890, height: 1080 },
  );
  expect(
    'a 540p source defaults to 1080p',
    resolveVideoUpscaleOutput({ sourceWidth: 960, sourceHeight: 540 }),
    { resolution: 1080, width: 1920, height: 1080 },
  );
  expect('default helper agrees for 540p', defaultVideoUpscaleResolution(960, 540), 1080);
  expect('default helper picks 1440p for 720p', defaultVideoUpscaleResolution(1280, 720), 1440);
  expect('default helper refuses 480p', defaultVideoUpscaleResolution(854, 480), null);
  expect(
    'an explicit 1440p on a 540p source explains the limit',
    errorMessage(() => resolveVideoUpscaleOutput({ sourceWidth: 960, sourceHeight: 540, targetResolution: 1440 })),
    '1440p needs a source at least 720px on its short edge; this video is 960×540.',
  );
  expect(
    'a 480p source is too small for either resolution',
    errorMessage(() => resolveVideoUpscaleOutput({ sourceWidth: 854, sourceHeight: 480 })),
    '1080p needs a source at least 540px on its short edge; this video is 854×480.',
  );
  expect(
    'a 1080p source is outside the source limit',
    errorMessage(() => resolveVideoUpscaleOutput({ sourceWidth: 1920, sourceHeight: 1080 })),
    'This video is 1920×1080; video upscaling accepts sources up to 768px on the short edge.',
  );
  expect(
    'a 16:9 source at the size limit reaches 1440p',
    resolveVideoUpscaleOutput({ sourceWidth: 1344, sourceHeight: 756 }),
    { resolution: 1440, width: 2560, height: 1440 },
  );
  expect(
    'an ultra-wide source larger than the source area is refused',
    errorMessage(() => resolveVideoUpscaleOutput({ sourceWidth: 1792, sourceHeight: 768 })),
    'This video is 1792×768; video upscaling accepts sources up to about 1344×768 pixels, or 768×1344 in portrait.',
  );
  expect('default helper refuses an oversized 21:9 source', defaultVideoUpscaleResolution(1680, 720), null);
  expect(
    'an unsupported resolution is refused',
    errorMessage(() => resolveVideoUpscaleOutput({ sourceWidth: 1280, sourceHeight: 720, targetResolution: 2160 })),
    'Choose 1080p or 1440p for video upscaling.',
  );

  // --- source timing ---------------------------------------------------------
  expect('158 frames at 24 fps passes', errorMessage(() => validateVideoUpscaleSourceTiming({ frames: 158, fps: 24 })), null);
  expect(
    '361 frames at 24000/1001 passes',
    errorMessage(() => validateVideoUpscaleSourceTiming({ frames: 361, fps: 24000 / 1001 })),
    null,
  );
  // No client-side length cap: the server's admission check alone refuses a
  // source that is too long, so long sources pass these public checks.
  for (const [frames, fps] of [[362, 24000 / 1001], [900, 30], [1800, 30], [7200, 60]] as const) {
    expect(
      `${frames} frames at ${Number(fps.toFixed(3))} fps passes`,
      errorMessage(() => validateVideoUpscaleSourceTiming({ frames, fps })),
      null,
    );
  }
  expect(
    'source limits carry no frame-count or duration cap',
    Object.keys(VIDEO_UPSCALE_SOURCE_LIMITS).filter((key) => /frame|duration/i.test(key)),
    [],
  );
  expect(
    'an unreadable frame count is refused',
    errorMessage(() => validateVideoUpscaleSourceTiming({ frames: 0, fps: 24 })),
    'The source video frame count or frame rate could not be read.',
  );
  expect(
    'a frame rate above 60 is refused',
    errorMessage(() => validateVideoUpscaleSourceTiming({ frames: 120, fps: 120 })),
    'This video runs at 120 fps; video upscaling accepts 1-60 fps.',
  );
  expect(
    'an oversized file is refused',
    errorMessage(() =>
      validateVideoUpscaleSourceTiming({ frames: 120, fps: 24, sizeBytes: VIDEO_UPSCALE_SOURCE_LIMITS.maxBytes + 1 }),
    ),
    'Video upscaling accepts source files up to 100 MB.',
  );

  // --- wrapper project validation -------------------------------------------
  const wrapperMessage = (config: Record<string, unknown>): string | null => {
    try {
      validateProjectConfig(config as never);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  expect(
    'wrapper accepts a promptless minimal upscale config',
    wrapperMessage({ type: 'video', modelId: VIDEO_UPSCALE_MODEL_ID, positivePrompt: '', numberOfMedia: 1, upscaleResolution: 1440 }),
    null,
  );
  expect(
    'wrapper accepts a 2560px upscale output edge',
    wrapperMessage({ type: 'video', modelId: VIDEO_UPSCALE_MODEL_ID, positivePrompt: '', numberOfMedia: 1, width: 2560, height: 1440 }),
    null,
  );
  expect(
    'wrapper accepts an 1800-frame FlashVSR source: only the server caps length',
    wrapperMessage({ type: 'video', modelId: VIDEO_UPSCALE_MODEL_ID, positivePrompt: '', numberOfMedia: 1, frames: 1800, fps: 30 }),
    null,
  );
  expect(
    'wrapper refuses a fractional FlashVSR frame count',
    wrapperMessage({ type: 'video', modelId: VIDEO_UPSCALE_MODEL_ID, positivePrompt: '', numberOfMedia: 1, frames: 158.5 }),
    'Frames must be a whole number of at least 1',
  );
  expect(
    'other video models keep the 2001-frame wrapper bound',
    wrapperMessage({ type: 'video', modelId: 'ltx25-22b-int8_t2v_distilled', positivePrompt: 'x', frames: 2002 }),
    'Frames must be between 1 and 2001',
  );
  expect(
    'other video models keep the 2048px wrapper bound',
    wrapperMessage({ type: 'video', modelId: 'ltx25-22b-int8_t2v_distilled', positivePrompt: 'x', width: 2560, height: 1440 }),
    'Width must be between 256 and 2048',
  );

  console.log(`\nvideoUpscale: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}

const isMain = process.argv[1]?.includes('video-upscale-tests');
if (isMain) {
  const { failed } = runVideoUpscaleTests();
  process.exit(failed > 0 ? 1 : 0);
}
