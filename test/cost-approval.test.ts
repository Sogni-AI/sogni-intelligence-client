import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { isCostApprovalGatedTool } from '../src/chatRun/costApproval.js';
import { TOOL_COST_METADATA, getToolCostMetadata } from '../src/contracts/data/toolCostMetadata.js';
import { generationToolDefinitions } from '../src/tools/definitions/index.js';
import {
  APP_TOOLS_MANIFEST,
  COMPOSITION_TOOLS_MANIFEST,
  GENERATION_TOOLS_MANIFEST,
} from '../src/openai-tools/index.js';
import {
  ALL_BUILT_IN_SKILLS,
  PUBLIC_SKILL_DEFAULT_TOOL_DEFINITIONS,
  PUBLIC_SKILL_DEFAULT_TOOL_NAMES,
} from '../src/public-skill-runtime/index.js';
import {
  BACKBONE_APP_TOOL_NAMES,
  BACKBONE_COMPOSITION_TOOL_NAMES,
  BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES,
  BACKBONE_GENERATION_TOOL_NAMES,
  BACKBONE_HOSTED_APP_TOOL_NAMES,
  CANONICAL_TOOL_CATALOG,
} from '../src/contracts/index.js';

test('every defined chat tool has cost metadata', async () => {
  const definitionFiles = readdirSync(new URL('../src/tools/definitions/', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  const fileDefinitions = await Promise.all(definitionFiles.map(async (entry) => {
    const module = await import(`../src/tools/definitions/${entry.name}/definition.js`);
    return module.definition;
  }));
  const definitions = [
    ...fileDefinitions,
    ...generationToolDefinitions,
    ...GENERATION_TOOLS_MANIFEST.tools,
    ...COMPOSITION_TOOLS_MANIFEST.tools,
    ...APP_TOOLS_MANIFEST.tools,
    ...PUBLIC_SKILL_DEFAULT_TOOL_DEFINITIONS,
  ];
  const names = new Set([
    ...definitions.map((tool) => tool.function.name),
    ...PUBLIC_SKILL_DEFAULT_TOOL_NAMES,
    ...ALL_BUILT_IN_SKILLS.flatMap((skill) => skill.toolNames),
    ...BACKBONE_APP_TOOL_NAMES,
    ...BACKBONE_COMPOSITION_TOOL_NAMES,
    ...BACKBONE_DURABLE_HOSTED_CREATIVE_TOOL_NAMES,
    ...BACKBONE_GENERATION_TOOL_NAMES,
    ...BACKBONE_HOSTED_APP_TOOL_NAMES,
    ...CANONICAL_TOOL_CATALOG.map((tool) => tool.tool),
  ]);
  const missing = [...names].filter((name) => !getToolCostMetadata(name)).sort();
  assert.deepEqual(missing, [], 'Defined tools need cost metadata');
});

test('tools without cost metadata require confirmation for every option shape', () => {
  const name = 'future_catalog_tool';
  for (const options of [
    undefined,
    {},
    { knownCreativeToolNames: new Set<string>() },
    { knownCreativeToolNames: new Set(['generate_image']) },
    { knownCreativeToolNames: new Set([name]) },
  ]) {
    assert.equal(isCostApprovalGatedTool(name, options), true);
  }
});

test('existing cost classes retain their confirmation behavior', () => {
  for (const entry of TOOL_COST_METADATA) {
    const expected = entry.costClass !== 'free' && entry.costClass !== 'compose.standard';
    assert.equal(isCostApprovalGatedTool(entry.tool), expected, entry.tool);
    assert.equal(isCostApprovalGatedTool(entry.tool, {
      knownCreativeToolNames: new Set([entry.tool]),
    }), expected, entry.tool);
  }
});
