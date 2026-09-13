import { MINIMAX_H3_TWO_STAGE_MODEL_IDS } from '../media/videoSettings.js';
import {
  isSeedanceVideoModelId,
  resolveSeedanceVideoModelId,
} from './seedanceModelIds.js';

export type RegisteredVideoModelFamily =
  | 'seedance'
  | 'ltx25'
  | 'ltx23'
  | 'ltx2'
  | 'wan22'
  | 'minimax-h3'
  | 'happyhorse-1.1'
  | 'wan3';

function normalizeVideoModelId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')
    .replace(/-+/g, '-');
}

function normalizedSet(values: readonly string[]): ReadonlySet<string> {
  return new Set(values.map(normalizeVideoModelId));
}

const LTX_WORKFLOWS = ['t2v', 'i2v', 'a2v', 'ia2v', 'v2v'] as const;
const LTX23_MODEL_IDS = normalizedSet([
  'ltx23',
  'ltx-2.3',
  'ltx-v2.3',
  'ltx23-eros',
  '10eros',
  'ltx23-22b-10eros-v1.4-fp8mixed_i2v',
  ...LTX_WORKFLOWS.flatMap(workflow => [
    `ltx23-${workflow}`,
    `ltx-2.3-${workflow}`,
    `ltx-v2.3-${workflow}`,
    `ltx23-22b-fp8_${workflow}_distilled`,
    `ltx23-22b-fp8_${workflow}_dev`,
  ]),
]);
const LTX25_MODEL_IDS = normalizedSet([
  'ltx25',
  'ltx-2.5',
  'ltx-v2.5',
  ...LTX_WORKFLOWS.flatMap(workflow => [
    `ltx25-${workflow}`,
    `ltx-2.5-${workflow}`,
    `ltx-v2.5-${workflow}`,
    `ltx25-22b-int8_${workflow}_distilled`,
    `ltx25-22b-int8_${workflow}_dev`,
  ]),
]);
const LTX2_MODEL_IDS = normalizedSet([
  ...LTX_WORKFLOWS.flatMap(workflow => [
    `ltx2-19b-fp8_${workflow}`,
    `ltx2-19b-fp8_${workflow}_distilled`,
  ]),
]);

const WAN22_MODEL_IDS = normalizedSet([
  'wan22',
  'wan-2.2',
  'wan-v2.2',
  'wan-s2v',
  'wan22-t2v',
  'wan22-i2v',
  'wan22-s2v',
  'wan22-animate',
  'wan22-animate-move',
  'wan22-animate-replace',
  'wan_v2.2-14b-fp8_t2v',
  'wan_v2.2-14b-fp8_i2v',
  'wan_v2.2-14b-fp8_t2v_lightx2v',
  'wan_v2.2-14b-fp8_i2v_lightx2v',
  'wan_v2.2-14b-fp8_s2v_lightx2v',
  'wan_v2.2-14b-fp8_animate-move_lightx2v',
  'wan_v2.2-14b-fp8_animate-replace_lightx2v',
]);

const MINIMAX_H3_MODEL_IDS = normalizedSet([
  'minimax-h3',
  'minimax-h3-turbo',
  'minimax-h3-fasth3-turbo',
  ...['t2v', 'i2v', 'flf2v', 'r2v'].flatMap(workflow => [
    `minimax-h3-${workflow}`,
    `minimax-h3-${workflow}-turbo`,
  ]),
  ...['t2v', 'i2v', 'flf2v'].flatMap(workflow => [
    `minimax-h3-fl2va-fp8_${workflow}`,
    `minimax-h3-fl2va-fp8_${workflow}_turbo`,
    `minimax-h3-fasth3-${workflow}-turbo`,
    `minimax-h3-fastvideo-int8_${workflow}_turbo`,
  ]),
  'minimax-h3-ref2va-fp8_r2v',
  'minimax-h3-ref2va-fp8_r2v_turbo',
  ...MINIMAX_H3_TWO_STAGE_MODEL_IDS,
]);

// These workflows treat every supplied image as loose conditioning context,
// never as a first/last-frame canvas anchor. Keep this list separate from the
// broader family registry: the wrapper uses it to decide whether a binary
// `referenceImage` may define or resize the output canvas.
const LOOSE_REFERENCE_VIDEO_MODEL_IDS = normalizedSet([
  'minimax-h3-r2v',
  'minimax-h3-r2v-turbo',
  'minimax-h3-ref2va-fp8_r2v',
  'minimax-h3-ref2va-fp8_r2v_turbo',
  'happyhorse-1.1-r2v',
]);

const HAPPYHORSE_11_MODEL_IDS = normalizedSet([
  'happyhorse-1.1',
  'happyhorse-1.1-t2v',
  'happyhorse-1.1-i2v',
  'happyhorse-1.1-r2v',
]);
const WAN3_MODEL_IDS = normalizedSet([
  'wan3',
  'wan3.0',
  'wan3-video',
  'wan3.0-video',
  'wan3-enhanced',
  'wan3.0-enhanced',
  'wan3-spicy',
  'wan3.0-spicy',
  'wan3.0-spicy-video',
]);

export function resolveRegisteredVideoModelFamily(
  value: string | null | undefined,
): RegisteredVideoModelFamily | null {
  if (!value) return null;
  if (resolveSeedanceVideoModelId(value)) return 'seedance';
  const modelId = normalizeVideoModelId(value);
  if (LTX25_MODEL_IDS.has(modelId)) return 'ltx25';
  if (LTX23_MODEL_IDS.has(modelId)) return 'ltx23';
  if (LTX2_MODEL_IDS.has(modelId)) return 'ltx2';
  if (WAN22_MODEL_IDS.has(modelId)) return 'wan22';
  if (MINIMAX_H3_MODEL_IDS.has(modelId)) return 'minimax-h3';
  if (HAPPYHORSE_11_MODEL_IDS.has(modelId)) return 'happyhorse-1.1';
  if (WAN3_MODEL_IDS.has(modelId)) return 'wan3';
  return null;
}

export function isRegisteredLtxVideoModelId(value: string | null | undefined): boolean {
  const family = resolveRegisteredVideoModelFamily(value);
  return family === 'ltx25' || family === 'ltx23' || family === 'ltx2';
}

export function isRegisteredWanVideoModelId(value: string | null | undefined): boolean {
  return resolveRegisteredVideoModelFamily(value) === 'wan22';
}

export function isRegisteredMiniMaxH3VideoModelId(value: string | null | undefined): boolean {
  return resolveRegisteredVideoModelFamily(value) === 'minimax-h3';
}

export function isRegisteredLooseReferenceVideoModelId(value: string | null | undefined): boolean {
  if (!value) return false;
  return LOOSE_REFERENCE_VIDEO_MODEL_IDS.has(normalizeVideoModelId(value));
}

export function isRegisteredHappyHorseVideoModelId(value: string | null | undefined): boolean {
  return resolveRegisteredVideoModelFamily(value) === 'happyhorse-1.1';
}

export function isRegisteredWan3VideoModelId(value: string | null | undefined): boolean {
  return resolveRegisteredVideoModelFamily(value) === 'wan3';
}

export { isSeedanceVideoModelId };
