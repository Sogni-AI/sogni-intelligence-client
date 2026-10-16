/**
 * Unit tests for HAPPYHORSE_REFERENCE_LIMITS, HappyHorseReferenceLimitError,
 * getHappyHorseReferenceLimits(), and validateHappyHorseReferenceCounts().
 */
import {
  HAPPYHORSE_REFERENCE_LIMITS,
  HappyHorseReferenceLimitError,
  getHappyHorseReferenceLimits,
  validateHappyHorseReferenceCounts,
} from '../src/tools/index';
import {
  happyhorseTerminalGenerationFailurePayloadFromError,
  happyhorseTerminalPolicyPayloadFromError,
} from '../src/tools/index';
import {
  formatModelRef,
  getModelRefFormat,
  getModelRefFormatResolution,
} from '../src/skills/asset_reference_management/index';

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

function expectThrows(
  label: string,
  fn: () => void,
  predicate: (err: unknown) => boolean,
) {
  try {
    fn();
    console.error(`❌ FAIL: ${label} — expected throw, got none`);
    testsFailed++;
  } catch (err) {
    if (predicate(err)) {
      console.log(`✅ PASS: ${label}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${label} — wrong error shape: ${(err as Error)?.message}`);
      testsFailed++;
    }
  }
}

export function runHappyHorseReferencesTests(): { passed: number; failed: number } {
  console.log('\n🧪 HappyHorse reference limits\n');

  // Per-model limits
  expect('t2v images = 0', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-t2v'].images, 0);
  expect('i2v images = 1', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-i2v'].images, 1);
  expect('r2v images = 9', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-r2v'].images, 9);
  expect('r2v videos = 0', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-r2v'].videos, 0);
  expect('r2v audios = 0', HAPPYHORSE_REFERENCE_LIMITS['happyhorse-1.1-r2v'].audios, 0);

  expect(
    'getHappyHorseReferenceLimits(i2v).images = 1',
    getHappyHorseReferenceLimits('happyhorse-1.1-i2v')?.images,
    1,
  );
  expect(
    'getHappyHorseReferenceLimits(non-happyhorse) = null',
    getHappyHorseReferenceLimits('seedance-2-0'),
    null,
  );

  // Within limits
  expect(
    'validate r2v: 9/0/0 ok',
    (() => { validateHappyHorseReferenceCounts('happyhorse-1.1-r2v', { images: 9, videos: 0, audios: 0 }); return 'ok'; })(),
    'ok',
  );
  expect(
    'validate i2v: 1/0/0 ok',
    (() => { validateHappyHorseReferenceCounts('happyhorse-1.1-i2v', { images: 1, videos: 0, audios: 0 }); return 'ok'; })(),
    'ok',
  );
  expect(
    'validate t2v: 0/0/0 ok',
    (() => { validateHappyHorseReferenceCounts('happyhorse-1.1-t2v', { images: 0, videos: 0, audios: 0 }); return 'ok'; })(),
    'ok',
  );

  // Per-mode overflow
  expectThrows(
    'validate t2v: 1 image throws images limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-t2v', { images: 1, videos: 0, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError
      && err.limitKind === 'images'
      && err.maxCount === 0
      && err.code === 'happyhorse_reference_limit_exceeded',
  );
  expectThrows(
    'validate i2v: 2 images throws images limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-i2v', { images: 2, videos: 0, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError
      && err.limitKind === 'images'
      && err.requestedCount === 2
      && err.maxCount === 1,
  );
  expectThrows(
    'validate r2v: 10 images throws images limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-r2v', { images: 10, videos: 0, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError && err.limitKind === 'images' && err.maxCount === 9,
  );
  expectThrows(
    'validate r2v: any video reference throws videos limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-r2v', { images: 0, videos: 1, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError && err.limitKind === 'videos' && err.maxCount === 0,
  );
  expectThrows(
    'validate r2v: any audio reference throws audios limit error',
    () => validateHappyHorseReferenceCounts('happyhorse-1.1-r2v', { images: 0, videos: 0, audios: 1 }),
    (err) => err instanceof HappyHorseReferenceLimitError && err.limitKind === 'audios' && err.maxCount === 0,
  );

  // Unknown model id rejected
  expectThrows(
    'validate unknown model id throws',
    () => validateHappyHorseReferenceCounts('happyhorse-9.9-x2v', { images: 0, videos: 0, audios: 0 }),
    (err) => err instanceof HappyHorseReferenceLimitError,
  );

  // Limits frozen
  expect(
    'HAPPYHORSE_REFERENCE_LIMITS is frozen',
    Object.isFrozen(HAPPYHORSE_REFERENCE_LIMITS),
    true,
  );

  // Failure normalizer — verified live failure schema (output.code/output.message)
  const downloadFailure = happyhorseTerminalGenerationFailurePayloadFromError({
    name: 'Error',
    message: 'HappyHorse vendor job failed',
    output: { task_status: 'FAILED', code: 'InvalidParameter', message: 'Failed to download https://example.com/x.jpg' },
  });
  expect(
    'download failure → happyhorse_input_download_failed',
    downloadFailure?.error,
    'happyhorse_input_download_failed',
  );
  expect(
    'download failure carries vendor code',
    (downloadFailure as { vendorErrorCode?: string } | null)?.vendorErrorCode,
    'InvalidParameter',
  );

  const genericFailure = happyhorseTerminalGenerationFailurePayloadFromError(
    new Error('All 1 video generation jobs failed for happyhorse-1.1-t2v'),
  );
  expect(
    'generic vendor failure → happyhorse_generation_failed',
    genericFailure?.error,
    'happyhorse_generation_failed',
  );

  // Unrelated error → null (not misattributed)
  expect(
    'unrelated error → null',
    happyhorseTerminalGenerationFailurePayloadFromError(new Error('ltx2 worker disconnected')),
    null,
  );

  // Content-policy detection only when HappyHorse is named
  const policy = happyhorseTerminalPolicyPayloadFromError(
    new Error('HappyHorse rejected the request: sensitive content detected by moderation'),
  );
  expect('content-policy payload error code', policy?.error, 'happyhorse_content_policy');
  expect(
    'content-policy not attributed to unnamed vendor',
    happyhorseTerminalPolicyPayloadFromError(new Error('sensitive content detected by moderation')),
    null,
  );

  // ── model_ref formatting: HappyHorse r2v uses bracketed ordinals ──
  // Capture console.warn to prove the GPT-Image-2 fallback (which warns) is
  // not taken for happyhorse ids.
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  let happyHorseRef = '';
  let resolution: ReturnType<typeof getModelRefFormatResolution> | null = null;
  let concreteResolution: ReturnType<typeof getModelRefFormatResolution> | null = null;
  try {
    happyHorseRef = formatModelRef('happyhorse', 1, 'image');
    resolution = getModelRefFormatResolution('happyhorse');
    // The explicitly registered concrete id resolves without a family-prefix guess.
    concreteResolution = getModelRefFormatResolution('happyhorse-1.1-r2v');
  } finally {
    console.warn = originalWarn;
  }

  expect("formatModelRef('happyhorse',1,'image') === '[Image 1]'", happyHorseRef, '[Image 1]');
  expect('happyhorse video ref is bracketed', formatModelRef('happyhorse', 3, 'video'), '[Video 3]');
  expect('happyhorse audio ref is bracketed', formatModelRef('happyhorse', 2, 'audio'), '[Audio 2]');
  expect('happyhorse resolution did not fall back', resolution?.fell_back, false);
  expect('happyhorse resolved model_id', resolution?.model_id, 'happyhorse');
  expect('happyhorse-1.1-r2v concrete id did not fall back', concreteResolution?.fell_back, false);
  expect('happyhorse-1.1-r2v concrete id model_id', concreteResolution?.model_id, 'happyhorse');
  expect('no fallback warning emitted for happyhorse', warnings.length, 0);

  // parse/scan round-trip `[Image 2]`.
  const hhFormat = getModelRefFormat('happyhorse');
  expect('happyhorse parse([Image 2]) round-trips', hhFormat.parse('[Image 2]'), { index: 2, type: 'image' });
  expect(
    'happyhorse parse(format(2,image)) round-trips',
    hhFormat.parse(formatModelRef('happyhorse', 2, 'image')),
    { index: 2, type: 'image' },
  );
  expect(
    'happyhorse scanRegex matches [Image 2] in prose',
    'use [Image 2] for the hero shot'.match(hhFormat.scanRegex)?.[0] ?? null,
    '[Image 2]',
  );
  // Bare (GPT) form is NOT a HappyHorse reference.
  expect('happyhorse parse rejects bare Image 2', hhFormat.parse('Image 2'), null);

  // Krea Identity Edit uses context_image_N tokens and must not fall back to GPT-style refs.
  const kreaResolution = getModelRefFormatResolution('krea2_identity_edit_v1_2');
  const kreaAliasResolution = getModelRefFormatResolution('krea-2-identity-edit');
  const darkBeastResolution = getModelRefFormatResolution('dark-beast-krea2-identity-edit');
  const darkBeastWorkerResolution = getModelRefFormatResolution('dark_beast_krea2_identity_edit_v1_2');
  expect(
    "formatModelRef('krea2_identity_edit_v1_2',1,'image') === 'context_image_0'",
    formatModelRef('krea2_identity_edit_v1_2', 1, 'image'),
    'context_image_0',
  );
  expect('Krea identity raw id did not fall back', kreaResolution.fell_back, false);
  expect('Krea identity raw id resolved model_id', kreaResolution.model_id, 'krea-identity-edit');
  expect('Krea identity alias did not fall back', kreaAliasResolution.fell_back, false);
  expect('Krea identity alias resolved model_id', kreaAliasResolution.model_id, 'krea-identity-edit');
  expect('Dark Beast Krea selector did not fall back', darkBeastResolution.fell_back, false);
  expect('Dark Beast Krea selector resolved model_id', darkBeastResolution.model_id, 'krea-identity-edit');
  expect('Dark Beast Krea worker id did not fall back', darkBeastWorkerResolution.fell_back, false);
  expect('Dark Beast Krea worker id resolved model_id', darkBeastWorkerResolution.model_id, 'krea-identity-edit');

  // FLUX 3 Image Klein names references by order, as BFL's upsampler does, not GPT-style "Image N".
  for (const id of ['flux-3-klein', 'flux3_image_klein_sd_int8_convrot', 'FLUX 3 Image Klein']) {
    const resolution = getModelRefFormatResolution(id);
    expect(`Klein ${id} did not fall back`, resolution.fell_back, false);
    expect(`Klein ${id} resolved model_id`, resolution.model_id, 'flux3-klein');
  }
  expect("formatModelRef('flux-3-klein',1,'image')", formatModelRef('flux-3-klein', 1, 'image'), 'the first image');
  expect("formatModelRef('flux-3-klein',6,'image')", formatModelRef('flux-3-klein', 6, 'image'), 'the sixth image');
  const kleinFormat = getModelRefFormatResolution('flux-3-klein').format;
  expect('Klein parse round-trips', JSON.stringify(kleinFormat.parse('the second image')), JSON.stringify({ index: 2, type: 'image' }));
  expect('Klein parse rejects Image 2', kleinFormat.parse('Image 2'), null);
  expect(
    'Klein scan finds ordinal refs',
    JSON.stringify('Put the dog from the second image on the mug in the first image.'.match(kleinFormat.scanRegex)),
    JSON.stringify(['the second image', 'the first image']),
  );

  console.log(`\nhappyhorse references: ${testsPassed} passed, ${testsFailed} failed`);
  return { passed: testsPassed, failed: testsFailed };
}
