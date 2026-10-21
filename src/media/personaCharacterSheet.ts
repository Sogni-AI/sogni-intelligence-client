/**
 * One-pass persona character sheets: which models make them, the canvas each
 * renders at, which saved photos go in, and the prompt. The Sogni app studio,
 * Sogni Chat, sogni-api and the skill all build persona sheets from these.
 */
import { CHARACTER_SHEET_DEFAULT_CANVAS } from './characterSheet.js';

export interface PersonaSheetModel {
  id: string;
  label: string;
  /** Plain one-line purpose for pickers. */
  purpose: string;
  /** Most persona photos the model reads; 0 means it works from the description only. */
  maxPhotos: number;
  /** The model edits a photo and cannot start from a description alone. */
  needsPhoto: boolean;
  width: number;
  height: number;
  /** Vendor model paid with Premium Spark. */
  premium?: boolean;
  /** GPT Image quality the sheet renders at. */
  gptImageQuality?: 'high';
}

const KREA_SHEET_CANVAS = { width: 1024, height: 1024 } as const;
const WIDE_SHEET_CANVAS = {
  width: CHARACTER_SHEET_DEFAULT_CANVAS.width,
  height: CHARACTER_SHEET_DEFAULT_CANVAS.height,
} as const;

export const PERSONA_SHEET_MODELS: readonly PersonaSheetModel[] = [
  {
    id: 'krea2_identity_edit_v1_2',
    label: 'Krea 2 Identity Edit',
    purpose: 'Best likeness from a photo',
    maxPhotos: 2,
    needsPhoto: true,
    ...KREA_SHEET_CANVAS,
  },
  {
    id: 'dark_beast_krea2_identity_edit_v1_2',
    label: 'Dark Beast Krea 2 Identity Edit',
    purpose: 'Krea likeness without content limits',
    maxPhotos: 2,
    needsPhoto: true,
    ...KREA_SHEET_CANVAS,
  },
  {
    id: 'qwen_image_edit_2511_fp8_lightning',
    label: 'Qwen Image Edit 2511 Lightning',
    purpose: 'Fast edit of a photo',
    maxPhotos: 3,
    needsPhoto: true,
    ...WIDE_SHEET_CANVAS,
  },
  {
    id: 'flux3_image_klein_sd_int8_convrot',
    label: 'FLUX 3 Image Klein',
    purpose: 'Quick and low-cost, from photos or a description',
    maxPhotos: 10,
    needsPhoto: false,
    ...WIDE_SHEET_CANVAS,
  },
  {
    id: 'gpt-image-2.5-sunburst',
    label: 'GPT Image 2.5 Sunburst',
    purpose: 'Most detailed layout, from photos or a description',
    maxPhotos: 16,
    needsPhoto: false,
    premium: true,
    gptImageQuality: 'high',
    ...WIDE_SHEET_CANVAS,
  },
  {
    id: 'moss_image_sft_int8_convrot',
    label: 'MOSS-Image',
    purpose: 'From the description only',
    maxPhotos: 0,
    needsPhoto: false,
    ...WIDE_SHEET_CANVAS,
  },
];

export function personaSheetModel(id: string | undefined): PersonaSheetModel | undefined {
  return PERSONA_SHEET_MODELS.find((model) => model.id === id);
}

/**
 * The sheet model a persona starts on: Krea 2 Identity Edit from a photo (as
 * Chat's character-sheet default does), GPT Image 2.5 Sunburst from a
 * description.
 */
export function defaultPersonaSheetModel(photoCount: number): PersonaSheetModel {
  return personaSheetModel(photoCount > 0 ? 'krea2_identity_edit_v1_2' : 'gpt-image-2.5-sunburst')!;
}

/** Why a model can't make this persona's sheet, or null when it can. */
export function personaSheetModelUnavailableReason(model: PersonaSheetModel, photoCount: number): string | null {
  return model.needsPhoto && photoCount === 0 ? 'Add a photo first' : null;
}

/** A saved persona image with the role it was saved under. */
export interface PersonaSheetPhoto {
  id: string;
  role: string;
}

/**
 * The photos a sheet starts from, in prompt order: a full-body photo first and
 * the face second (Krea Identity Edit's trained two-input order), or the main
 * identity photo alone. Character sheets and thumbnails never feed a new sheet.
 */
export function personaSheetPhotos<T extends PersonaSheetPhoto>(
  images: readonly T[],
  identityId: string | undefined,
  model: PersonaSheetModel,
): T[] {
  if (model.maxPhotos === 0) return [];
  const usable = images.filter((image) => image.role !== 'sheet' && image.role !== 'thumbnail');
  const identity = usable.find((image) => image.id === identityId)
    ?? usable.find((image) => image.role === 'portrait')
    ?? usable[0];
  if (!identity) return [];
  const body = [...usable].reverse().find((image) => image.role === 'front' && image.id !== identity.id);
  return body && model.maxPhotos >= 2 ? [body, identity] : [identity];
}

export interface PersonaSheetBrief {
  description?: string;
  appearance?: string;
  attire?: string;
}

const clip = (text: string | undefined, limit: number) => {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
};

/** The prompt for one character reference sheet rendered in a single pass. */
export function personaSheetPrompt(brief: PersonaSheetBrief, photoCount: number): string {
  const subject = photoCount >= 2
    ? 'the person from the reference images: Image 1 shows their body and outfit, Image 2 shows their face. Combine them into one person'
    : photoCount === 1
      ? 'the person in the reference image'
      : 'the character described below';
  const likeness = photoCount > 0
    ? 'Keep their exact likeness. Unless the character notes below ask for another style, keep the style of the reference: a photo stays photographic.'
    : '';
  const appearance = clip(brief.appearance, 600);
  const attire = clip(brief.attire, 400);
  const description = clip(brief.description, 800);
  return [
    `Create one character reference sheet of ${subject}.`,
    'Show the same person several times on a single plain light-grey studio background: a full-body front view, a full-body three-quarter view, a full-body side profile, a full-body back view, and a row of head-and-shoulders close-ups with a neutral, a smiling and a speaking expression.',
    'Keep the face, age, skin tone, hairstyle, body proportions, markings and outfit identical in every view. Show head to toe in every full-body view, evenly spaced, nothing overlapping or cropped.',
    likeness,
    'Soft even lighting, sharp natural detail. No text, labels, captions, borders or color swatches.',
    appearance ? `Appearance: ${appearance}.` : '',
    attire ? `Outfit: ${attire}.` : '',
    description ? `Character: ${description}.` : '',
  ].filter(Boolean).join(' ');
}
