import { definition as generateImageDefinition } from './generate-image/definition.js';
import { definition as generateVideoDefinition } from './generate-video/definition.js';
import { definition as generateMusicDefinition } from './generate-music/definition.js';
import { definition as generateSpeechDefinition } from './generate-speech/definition.js';
import { definition as editImageDefinition } from './edit-image/definition.js';
import { definition as applyStyleDefinition } from './apply-style/definition.js';
import { definition as restorePhotoDefinition } from './restore-photo/definition.js';
import { definition as upscaleImageDefinition } from './upscale-image/definition.js';
import { definition as upscaleVideoDefinition } from './upscale-video/definition.js';
import { definition as refineResultDefinition } from './refine-result/definition.js';
import { definition as animatePhotoDefinition } from './animate-photo/definition.js';
import { definition as changeAngleDefinition } from './change-angle/definition.js';
import { definition as videoToVideoDefinition } from './video-to-video/definition.js';
import {
  definition as stitchVideoDefinition,
  STITCH_TRANSITION_TYPES,
} from './stitch-video/definition.js';
import { definition as orbitVideoDefinition } from './orbit-video/definition.js';
import { definition as danceMontageDefinition } from './dance-montage/definition.js';
import { definition as soundToVideoDefinition } from './sound-to-video/definition.js';
import { definition as extendVideoDefinition } from './extend-video/definition.js';
import { definition as replaceVideoSegmentDefinition } from './replace-video-segment/definition.js';
import {
  definition as overlayVideoDefinition,
  OVERLAY_POSITIONS,
} from './overlay-video/definition.js';
import {
  definition as addSubtitlesDefinition,
  SUBTITLE_VERTICAL_POSITIONS,
} from './add-subtitles/definition.js';
import type { ToolDefinition } from './types.js';

export {
  addSubtitlesDefinition,
  animatePhotoDefinition,
  applyStyleDefinition,
  changeAngleDefinition,
  danceMontageDefinition,
  editImageDefinition,
  extendVideoDefinition,
  generateImageDefinition,
  generateMusicDefinition,
  generateSpeechDefinition,
  generateVideoDefinition,
  orbitVideoDefinition,
  overlayVideoDefinition,
  refineResultDefinition,
  replaceVideoSegmentDefinition,
  restorePhotoDefinition,
  upscaleImageDefinition,
  upscaleVideoDefinition,
  soundToVideoDefinition,
  stitchVideoDefinition,
  videoToVideoDefinition,
  OVERLAY_POSITIONS,
  STITCH_TRANSITION_TYPES,
  SUBTITLE_VERTICAL_POSITIONS,
};

export const generationToolDefinitions = [
  generateImageDefinition,
  generateVideoDefinition,
  generateMusicDefinition,
  generateSpeechDefinition,
  editImageDefinition,
  applyStyleDefinition,
  restorePhotoDefinition,
  upscaleImageDefinition,
  upscaleVideoDefinition,
  refineResultDefinition,
  animatePhotoDefinition,
  changeAngleDefinition,
  videoToVideoDefinition,
  stitchVideoDefinition,
  orbitVideoDefinition,
  danceMontageDefinition,
  soundToVideoDefinition,
  extendVideoDefinition,
  replaceVideoSegmentDefinition,
  overlayVideoDefinition,
  addSubtitlesDefinition,
] as const satisfies readonly ToolDefinition[];

export { DANCE_PRESETS, resolveDancePresetForRequest } from './dance-montage/dances.js';
export type { DancePreset } from './dance-montage/dances.js';
export type { ToolDefinition } from './types.js';
