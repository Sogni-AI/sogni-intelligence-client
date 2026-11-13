import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { PROMPTING_GUIDES } from '../src/contracts/imagePrompt.js';
import {
  getModelPromptGuide,
  MODEL_PROMPT_GUIDES,
  renderModelPromptGuide,
  type ModelPromptGuide,
} from '../src/prompt-guides/index.js';
import { IMAGE_PROMPT_GUIDE_KEYS } from '../src/prompt-guides/image.js';

/** Every video family and mode @sogni/creative-agent's shaper and Screenwriters write prompts for. */
const VIDEO_MODES: Record<string, string[]> = {
  'seedance-2.0': ['t2v', 'i2v', 'l2v', 'flf', 'v2v'],
  'seedance-2.5': ['t2v', 'i2v', 'l2v', 'flf', 'v2v'],
  'ltx-2.5': ['t2v', 'i2v', 'l2v', 'flf', 'a2v', 'ia2v', 'v2v'],
  'ltx-2.3': ['t2v', 'i2v', 'flf', 'a2v', 'ia2v', 'v2v'],
  'wan-2.2': ['t2v', 'i2v', 'l2v', 'flf', 's2v', 'animate-move', 'animate-replace'],
  'wan-3': ['t2v', 'i2v', 'flf', 'r2v', 'a2v'],
  'happyhorse-1.1': ['t2v', 'i2v', 'r2v'],
  'minimax-h3': ['t2v', 'extend', 'i2v', 'l2v', 'flf', 'i2v-keyframes', 'r2v', 'ia2v', 'flfa2v', 'a2v', 'a2v-keyframes'],
};

/** Every image family the image prompt writer has a model guide for. */
const IMAGE_MODES: Record<string, string[]> = {
  chroma: ['generate'],
  'flux1-schnell': ['generate'],
  sdxl: ['generate'],
  sd15: ['generate'],
  pony: ['generate'],
  fast: ['generate'],
  sd3: ['generate'],
  krea2: ['generate', 'edit'],
  'moss-image': ['generate'],
  'flux3-klein': ['generate', 'edit'],
  qwen: ['generate', 'edit'],
  'z-image': ['generate'],
  'gpt-image': ['generate', 'edit'],
  seedream: ['generate', 'edit'],
  'seedream-5.5': ['generate', 'edit'],
};

function allGuides(): ModelPromptGuide[] {
  return Object.values(MODEL_PROMPT_GUIDES).flatMap((modes) => Object.values(modes) as ModelPromptGuide[]);
}

test('the registry covers every video and image family and mode creative-agent writes prompts for', () => {
  const registered = Object.fromEntries(
    Object.entries(MODEL_PROMPT_GUIDES).map(([family, modes]) => [family, Object.keys(modes)]),
  );
  assert.deepEqual(registered, { ...VIDEO_MODES, ...IMAGE_MODES });
});

test('every guide is keyed by its own family and mode and is well formed', () => {
  for (const [family, modes] of Object.entries(MODEL_PROMPT_GUIDES)) {
    for (const [mode, guide] of Object.entries(modes) as Array<[string, ModelPromptGuide]>) {
      const name = `${family} ${mode}`;
      assert.equal(guide.family, family, name);
      assert.equal(guide.mode, mode, name);
      assert.ok(guide.title.length > 0, name);
      assert.ok(guide.rules.length > 0, name);
      for (const rule of guide.rules) assert.ok(typeof rule === 'string' && rule.trim().length > 0, name);
      assert.ok(guide.referenceGrammar === null || guide.rules.includes(guide.referenceGrammar), name);
      assert.ok(Object.isFrozen(guide) && Object.isFrozen(guide.rules) && Object.isFrozen(guide.notes), name);
    }
  }
});

test('every model a guide lists resolves back to that guide', () => {
  for (const guide of allGuides()) {
    assert.ok(guide.models.length > 0, `${guide.family} ${guide.mode}`);
    for (const model of guide.models) {
      assert.equal(getModelPromptGuide(model, guide.mode), guide, `${model} ${guide.mode}`);
    }
  }
});

test('image guides carry the image prompt writer\'s own model guide', () => {
  for (const [promptingType, key] of Object.entries(IMAGE_PROMPT_GUIDE_KEYS)) {
    if (!key) continue;
    const guide = MODEL_PROMPT_GUIDES[key[0]][key[1]];
    assert.ok(guide, promptingType);
    assert.deepEqual(guide.rules, [PROMPTING_GUIDES[promptingType as keyof typeof PROMPTING_GUIDES]], promptingType);
  }
});

test('getModelPromptGuide resolves model ids and aliases with Sogni\'s resolvers', () => {
  const cases: Array<[model: string, mode: string | undefined, expected: string | null]> = [
    ['seedance2-5', undefined, 'seedance-2.5 t2v'],
    ['seedance-spicy', undefined, 'seedance-2.5 t2v'],
    ['seedance-2-5-uncensored', 'flf2v', 'seedance-2.5 flf'],
    ['seedance2-mini', undefined, 'seedance-2.0 t2v'],
    ['seedance2', 'V2V', 'seedance-2.0 v2v'],
    ['ltx25', undefined, 'ltx-2.5 t2v'],
    ['ltx25-ia2v', undefined, 'ltx-2.5 ia2v'],
    ['ltx23', 'flf', 'ltx-2.3 flf'],
    ['ltx2-19b-fp8_t2v', undefined, 'ltx-2.3 t2v'],
    ['ltx23', 'l2v', null],
    ['wan22', undefined, 'wan-2.2 t2v'],
    ['wan22-s2v', undefined, 'wan-2.2 s2v'],
    ['wan22-animate-move', undefined, 'wan-2.2 animate-move'],
    ['wan3', undefined, 'wan-3 t2v'],
    ['wan3-enhanced', 'r2v', 'wan-3 r2v'],
    ['happyhorse-1.1', undefined, 'happyhorse-1.1 t2v'],
    ['happyhorse-1.1-i2v', undefined, 'happyhorse-1.1 i2v'],
    ['happyhorse-1.1-r2v', undefined, 'happyhorse-1.1 r2v'],
    ['minimax-h3', undefined, 'minimax-h3 t2v'],
    ['minimax-h3', 'extend', 'minimax-h3 extend'],
    ['minimax-h3-i2v-balanced', undefined, 'minimax-h3 i2v'],
    ['minimax-h3-flf2v', undefined, 'minimax-h3 flf'],
    ['minimax-h3-fl2va-fp8_flf2v_turbo', undefined, 'minimax-h3 flf'],
    ['minimax-h3-r2v-balanced-2stage', undefined, 'minimax-h3 r2v'],
    ['minimax-h3-fasth3-ia2v-turbo', undefined, 'minimax-h3 ia2v'],
    ['minimax-h3-fasth3-flfa2v-turbo-2stage', undefined, 'minimax-h3 flfa2v'],
    ['minimax-h3-fasth3-a2v-turbo', undefined, 'minimax-h3 a2v'],
    ['krea-2', undefined, 'krea2 generate'],
    ['krea2_identity_edit_v1_2', undefined, 'krea2 edit'],
    ['qwen', undefined, 'qwen edit'],
    ['qwen-image-2512', undefined, 'qwen generate'],
    ['flux-3-klein', 'edit', 'flux3-klein edit'],
    ['gpt-image-2', 'i2i', 'gpt-image edit'],
    ['z-image-turbo', undefined, 'z-image generate'],
    ['seedream-5-pro-uncensored', 'edit', 'seedream edit'],
    ['seedream-5-5-uncensored', undefined, 'seedream-5.5 generate'],
    ['seedream-5-5-uncensored', 'edit', 'seedream-5.5 edit'],
    ['seedance2-5', 'generate', null],
    ['krea-2', 't2v', null],
    ['not-a-model', undefined, null],
    ['', undefined, null],
  ];
  for (const [model, mode, expected] of cases) {
    const guide = getModelPromptGuide(model, mode);
    assert.equal(guide ? `${guide.family} ${guide.mode}` : null, expected, `${model} ${mode ?? '(no mode)'}`);
  }
});

test('the shaper rendering is the rule block, joined by blank lines', () => {
  for (const guide of allGuides()) {
    assert.equal(renderModelPromptGuide(guide, { audience: 'shaper' }), guide.rules.join('\n\n'));
  }
});

test('the agent rendering carries every rule in order, with the reference grammar under its own heading', () => {
  for (const guide of allGuides()) {
    const name = `${guide.family} ${guide.mode}`;
    const text = renderModelPromptGuide(guide, { audience: 'agent' });
    assert.ok(text.startsWith(`# ${guide.title}\n\nGuide: ${guide.family} ${guide.mode}\nModels: `), name);
    assert.equal(text.includes('\n\n## Reference grammar\n\n'), guide.referenceGrammar !== null, name);
    let cursor = 0;
    if (guide.referenceGrammar !== null) {
      cursor = text.indexOf(`## Reference grammar\n\n${guide.referenceGrammar}`);
      assert.ok(cursor > 0, name);
    }
    const rulesAt = text.indexOf('\n\n## Rules\n\n');
    assert.ok(rulesAt > cursor, name);
    cursor = rulesAt;
    for (const rule of guide.rules.filter((entry) => entry !== guide.referenceGrammar)) {
      const at = text.indexOf(rule, cursor);
      assert.ok(at > cursor, `${name}: rule out of order or missing: ${rule.slice(0, 60)}`);
      cursor = at + rule.length;
    }
    assert.equal(text.includes('\n\n## Model notes\n\n'), guide.notes.length > 0, name);
    for (const note of guide.notes) assert.ok(text.includes(`\n- ${note}`), name);
  }
});

test('rendering is deterministic', () => {
  for (const guide of allGuides()) {
    for (const audience of ['agent', 'shaper'] as const) {
      assert.equal(renderModelPromptGuide(guide, { audience }), renderModelPromptGuide(guide, { audience }));
    }
  }
  const guide = MODEL_PROMPT_GUIDES['wan-2.2']['animate-move'];
  assert.ok(guide);
  assert.equal(
    renderModelPromptGuide(guide, { audience: 'agent' }),
    [
      '# Wan 2.2 Animate movement transfer',
      'Guide: wan-2.2 animate-move\nModels: wan22',
      "Each rule below is quoted from the system prompt Sogni's own prompt writer uses for this model and mode, so some rules speak to that writer about its base request or user message.",
      '## Rules',
      guide.rules[0],
      '## Model notes',
      guide.notes.map((note) => `- ${note}`).join('\n'),
    ].join('\n\n'),
  );
  assert.throws(() => renderModelPromptGuide(guide, { audience: 'reader' as never }), /use "agent" or "shaper"/);
});

test('guides are found by model id and mode only, never by reading prompt text', () => {
  assert.equal(getModelPromptGuide.length, 2);
  const directory = join(__dirname, '..', 'src', 'prompt-guides');
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.ts'))) {
    const source = readFileSync(join(directory, file), 'utf8');
    for (const token of ['new RegExp(', '.test(', '.match(', '.matchAll(', '.search(', '.replace(/']) {
      assert.ok(!source.includes(token), `${file} uses ${token}: prompt guides must not gate on text`);
    }
  }
});
