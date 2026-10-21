/**
 * My Personas reference rules shared by every Sogni host: Sogni Chat (browser
 * and Managed Agent), sogni-api hosted tools, the Sogni app and the creative
 * agent skill.
 *
 * A persona carries original reference images (a main identity image plus
 * extra views and an assembled character sheet), a full voice recording with
 * its exact words for Qwen TTS cloning, and a short video voice excerpt. Hosts
 * attach these as ordinary uploads; these helpers name, order, select and
 * describe them the same way everywhere, so a negative upload index means the
 * same file in every host.
 *
 * Upload order: the user's own uploads, then one main identity image per
 * persona (in the order the personas were requested), then each persona's
 * extra views, then voice files. Every persona's main image comes before any
 * extra view, so a two-slot image editor never spends both slots on one
 * person's alternate angles.
 */

export type PersonaReferenceRole =
  | 'portrait'
  | 'front'
  | 'profile'
  | 'back'
  | 'expression'
  | 'sheet'
  | 'voice'
  | 'voice-video';

export type PersonaVoiceRole = Extract<PersonaReferenceRole, 'voice' | 'voice-video'>;

/**
 * Extra image views in the order reference-to-video models should receive
 * them. `portrait` appears here only when another image is the main identity.
 */
export const PERSONA_VIEW_ROLES = ['portrait', 'front', 'profile', 'back', 'expression', 'sheet'] as const satisfies readonly PersonaReferenceRole[];

const ROLE_LABELS: Record<PersonaReferenceRole, string> = {
  portrait: 'identity portrait',
  front: 'full body, front',
  profile: 'side profile',
  back: 'back view',
  expression: 'expression close-up',
  sheet: 'character sheet',
  voice: 'voice recording',
  'voice-video': 'video voice excerpt',
};

/** The persona fields hosts attach to an upload; filename is the fallback signal. */
export interface PersonaReferenceFileLike {
  type: string;
  filename?: string;
  personaId?: string;
  personaName?: string;
  personaRole?: PersonaReferenceRole;
  /** The persona's one main identity image */
  personaPrimary?: boolean;
  /** Exact words of a full voice recording */
  voiceTranscript?: string;
  /** Seconds, for audio */
  duration?: number;
}

const VIEW_ROLE_PATTERN = PERSONA_VIEW_ROLES.join('|');
const PERSONA_IMAGE_FILENAME = new RegExp(`^persona-(?!voiceclip-|voice-video-)(.+?)(?:\\.(${VIEW_ROLE_PATTERN}))?(?:\\.[^.]+)?$`, 'i');
const PERSONA_VOICE_FILENAME = /^persona-(voiceclip|voice-video)-(.+)$/i;

export function personaSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-') || 'persona';
}

export function personaRoleLabel(role: PersonaReferenceRole | undefined): string {
  return role ? ROLE_LABELS[role] : 'reference';
}

function imageExtension(mimeType: string | undefined): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/** `persona-<slug>.jpg` names a main identity image; image tools find a persona's photo by it. */
export function personaMainImageFilename(name: string): string {
  return `persona-${personaSlug(name)}.jpg`;
}

/** `persona-<slug>.<role>.<ext>` names an extra view. */
export function personaViewFilename(name: string, role: PersonaReferenceRole, mimeType?: string): string {
  return `persona-${personaSlug(name)}.${role}.${imageExtension(mimeType)}`;
}

/** Full recording `persona-voiceclip-<slug>`; video excerpt `persona-voice-video-<slug>`. */
export function personaVoiceFilename(name: string, role: PersonaVoiceRole): string {
  return role === 'voice' ? `persona-voiceclip-${personaSlug(name)}` : `persona-voice-video-${personaSlug(name)}`;
}

export interface ParsedPersonaFilename {
  kind: 'image' | 'voice';
  slug: string;
  role?: PersonaReferenceRole;
}

/** Read the persona slug and role from an injected filename (for hosts that only kept the name). */
export function parsePersonaFilename(filename: string | undefined, kind: 'image' | 'voice'): ParsedPersonaFilename | null {
  if (!filename) return null;
  if (kind === 'voice') {
    const match = filename.match(PERSONA_VOICE_FILENAME);
    if (!match) return null;
    return { kind, slug: match[2].trim().toLowerCase(), role: match[1].toLowerCase() === 'voiceclip' ? 'voice' : 'voice-video' };
  }
  const match = filename.match(PERSONA_IMAGE_FILENAME);
  if (!match?.[1]) return null;
  return {
    kind,
    slug: match[1].trim().toLowerCase(),
    ...(match[2] ? { role: match[2].toLowerCase() as PersonaReferenceRole } : {}),
  };
}

export function isPersonaFile(file: Pick<PersonaReferenceFileLike, 'filename' | 'personaId'>): boolean {
  return !!file.personaId || (file.filename?.startsWith('persona-') ?? false);
}

/** A persona's main identity image (also true for older injections without role metadata). */
export function isPersonaPrimaryImage(file: PersonaReferenceFileLike): boolean {
  if (file.type !== 'image' || !isPersonaFile(file)) return false;
  if (file.personaRole) return file.personaPrimary === true;
  return !parsePersonaFilename(file.filename, 'image')?.role;
}

/** An extra persona view (full body, profile, back, expression, sheet). */
export function isPersonaExtraView(file: PersonaReferenceFileLike): boolean {
  if (file.type !== 'image' || !isPersonaFile(file)) return false;
  if (file.personaRole) return file.personaPrimary !== true;
  return !!parsePersonaFilename(file.filename, 'image')?.role;
}

export function isPersonaVoiceFile(file: PersonaReferenceFileLike): boolean {
  return file.type === 'audio' && isPersonaFile(file);
}

// ---------------------------------------------------------------------------
// Building and ordering a persona's uploads
// ---------------------------------------------------------------------------

/** One saved reference, in whatever form the host holds it (bytes, URL, Blob). */
export type PersonaReferenceSource<T> = T & {
  role: PersonaReferenceRole;
  kind: 'image' | 'audio';
  mimeType?: string;
  isIdentity?: boolean;
};

export interface PersonaReferenceSet<T> {
  id: string;
  name: string;
  /** Exact words of the full voice recording */
  voiceTranscript?: string;
  references: ReadonlyArray<PersonaReferenceSource<T>>;
}

export type PersonaUpload<T> = Omit<T, 'role' | 'kind' | 'isIdentity'> & {
  type: 'image' | 'audio';
  filename: string;
  personaId: string;
  personaName: string;
  personaRole: PersonaReferenceRole;
  personaPrimary?: true;
  voiceTranscript?: string;
};

export interface OrderedPersonaUploads<T> {
  primaries: PersonaUpload<T>[];
  extraViews: PersonaUpload<T>[];
  voices: PersonaUpload<T>[];
}

function mainImage<T>(images: ReadonlyArray<PersonaReferenceSource<T>>): PersonaReferenceSource<T> | undefined {
  return images.find((image) => image.isIdentity)
    ?? images.find((image) => image.role === 'portrait')
    ?? images[0];
}

function toUpload<T>(
  source: PersonaReferenceSource<T>,
  persona: PersonaReferenceSet<T>,
  filename: string,
  extra: { personaPrimary?: true; voiceTranscript?: string },
): PersonaUpload<T> {
  const { role, kind, isIdentity: _isIdentity, ...payload } = source;
  return {
    ...(payload as Omit<T, 'role' | 'kind' | 'isIdentity'>),
    type: kind,
    filename,
    personaId: persona.id,
    personaName: persona.name,
    personaRole: role,
    ...extra,
  };
}

/**
 * Turn saved references into named uploads, grouped so a host can lay them out
 * as user uploads, then primaries, then extra views, then voices.
 */
export function orderPersonaUploads<T>(personas: ReadonlyArray<PersonaReferenceSet<T>>): OrderedPersonaUploads<T> {
  const ordered: OrderedPersonaUploads<T> = { primaries: [], extraViews: [], voices: [] };
  for (const persona of personas) {
    const images = persona.references.filter((ref) => ref.kind === 'image');
    const main = mainImage(images);
    if (main) ordered.primaries.push(toUpload(main, persona, personaMainImageFilename(persona.name), { personaPrimary: true }));
    for (const role of PERSONA_VIEW_ROLES) {
      const view = images.find((image) => image.role === role && image !== main);
      if (view) ordered.extraViews.push(toUpload(view, persona, personaViewFilename(persona.name, role, view.mimeType), {}));
    }
    for (const role of ['voice', 'voice-video'] as const) {
      const audio = persona.references.find((ref) => ref.kind === 'audio' && ref.role === role);
      if (!audio) continue;
      ordered.voices.push(toUpload(audio, persona, personaVoiceFilename(persona.name, role),
        role === 'voice' && persona.voiceTranscript ? { voiceTranscript: persona.voiceTranscript } : {}));
    }
  }
  return ordered;
}

/** Replace earlier persona uploads with fresh ones, keeping the user's own uploads first. */
export function withPersonaUploads<U extends PersonaReferenceFileLike, T>(
  uploads: readonly U[],
  personas: ReadonlyArray<PersonaReferenceSet<T>>,
  include: { images: boolean; voices: boolean } = { images: true, voices: true },
): Array<U | PersonaUpload<T>> {
  const ordered = orderPersonaUploads(personas);
  return [
    ...uploads.filter((file) => !isPersonaFile(file)),
    ...(include.images ? [...ordered.primaries, ...ordered.extraViews] : []),
    ...(include.voices ? ordered.voices : []),
  ];
}

// ---------------------------------------------------------------------------
// Selecting references for a reference-to-video call
// ---------------------------------------------------------------------------

/**
 * Upload ordinals (0-based within the image uploads) a reference-to-video call
 * takes when it names no images: the user's uploads, then persona main images,
 * then one extra view per persona in turn, within `room`. Returned in upload
 * order so @ImageN / <Picture N> / Image N follow upload indices.
 */
export function defaultReferenceImageOrdinals(
  imageUploads: readonly PersonaReferenceFileLike[],
  room: number,
  excluded: ReadonlySet<number> = new Set(),
): number[] {
  const entries = imageUploads
    .map((file, ordinal) => ({ file, ordinal }))
    .filter(({ ordinal }) => !excluded.has(ordinal));
  const userCount = entries.filter(({ file }) => !isPersonaFile(file)).length;
  const primaries = entries.filter(({ file }) => isPersonaPrimaryImage(file));
  const queues = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!isPersonaExtraView(entry.file)) continue;
    const key = entry.file.personaId ?? entry.file.personaName ?? parsePersonaFilename(entry.file.filename, 'image')?.slug ?? '';
    queues.set(key, [...(queues.get(key) ?? []), entry]);
  }
  const views: typeof entries = [];
  const pending = [...queues.values()];
  while (pending.some((queue) => queue.length > 0)) {
    for (const queue of pending) {
      const next = queue.shift();
      if (next) views.push(next);
    }
  }
  const chosen = new Set([...primaries, ...views].slice(0, Math.max(0, room - userCount)).map(({ ordinal }) => ordinal));
  return entries
    .filter(({ file, ordinal }) => !isPersonaFile(file) || chosen.has(ordinal))
    .map(({ ordinal }) => ordinal);
}

/**
 * A persona's voice file. `video` prefers the short excerpt (LTX Audio ID and
 * reference-video audio); `speech` prefers the full recording with its words
 * (Qwen TTS cloning). Each falls back to the other.
 */
export function findPersonaVoiceReference<T extends PersonaReferenceFileLike>(
  uploads: readonly T[],
  personaName: string | undefined,
  purpose: 'video' | 'speech',
): T | null {
  const name = personaName?.trim().toLowerCase();
  if (!name) return null;
  const slug = personaSlug(name);
  const voices = uploads.filter((file) => isPersonaVoiceFile(file)
    && (file.personaName?.trim().toLowerCase() === name
      || parsePersonaFilename(file.filename, 'voice')?.slug === slug));
  const isExcerpt = (file: T) => (file.personaRole ?? parsePersonaFilename(file.filename, 'voice')?.role) === 'voice-video';
  return voices.find((file) => (purpose === 'video') === isExcerpt(file)) ?? voices[0] ?? null;
}

/** Cloning speech from a persona's excerpt uses that persona's full recording instead, when it has one. */
export function preferFullPersonaRecording<T extends PersonaReferenceFileLike>(clip: T, uploads: readonly T[]): T {
  const role = clip.personaRole ?? parsePersonaFilename(clip.filename, 'voice')?.role;
  if (role !== 'voice-video') return clip;
  const name = clip.personaName ?? parsePersonaFilename(clip.filename, 'voice')?.slug;
  return findPersonaVoiceReference(uploads, name, 'speech') ?? clip;
}

// ---------------------------------------------------------------------------
// Describing references to the model
// ---------------------------------------------------------------------------

function uploadIndexWithinType<T extends PersonaReferenceFileLike>(uploads: readonly T[], file: T): number {
  const position = uploads.filter((candidate) => candidate.type === file.type).indexOf(file);
  return position < 0 ? 0 : -(position + 1);
}

/** One line per persona naming each attached reference with its negative upload index. */
export function describePersonaReferences<T extends PersonaReferenceFileLike>(uploads: readonly T[]): string[] {
  const byPersona = new Map<string, T[]>();
  for (const file of uploads) {
    if (!isPersonaFile(file) || !file.personaName) continue;
    byPersona.set(file.personaName, [...(byPersona.get(file.personaName) ?? []), file]);
  }
  return [...byPersona.entries()].map(([name, files]) => `${name}: ${files.map((file) => {
    const index = uploadIndexWithinType(uploads, file);
    if (file.type === 'audio') {
      const seconds = file.duration ? `, ${Math.round(file.duration)}s` : '';
      const transcript = file.voiceTranscript ? ', transcript saved' : '';
      return `${personaRoleLabel(file.personaRole)} audio ${index}${seconds}${transcript}`;
    }
    return `${file.personaPrimary ? 'main identity' : personaRoleLabel(file.personaRole)} image ${index}`;
  }).join('; ')}`);
}

/**
 * The user's saved personas as a planning fact. Hosts pass it to the turn
 * planner so a request naming a persona (or "me" for the one marked self) is
 * routed through resolve_personas; a persona merely existing is not a request
 * to depict it.
 */
export interface SavedPersonaFact {
  name: string;
  relationship: string;
  nicknames?: string[];
  hasVoice?: boolean;
}
