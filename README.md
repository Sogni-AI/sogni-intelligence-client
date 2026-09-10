# @sogni-ai/sogni-intelligence-client

[![NPM version](https://img.shields.io/npm/v/@sogni-ai/sogni-intelligence-client.svg)](https://www.npmjs.com/package/@sogni-ai/sogni-intelligence-client) [![License](https://img.shields.io/npm/l/@sogni-ai/sogni-intelligence-client.svg)](https://www.npmjs.com/package/@sogni-ai/sogni-intelligence-client)

The public, mid‑tier Node.js client for the [Sogni Supernet](https://sogni.ai/) — Sogni's OpenAI‑compatible LLM and agent API for image, video, music, and chat generation. Bundles a hardened wrapper over the [`@sogni-ai/sogni-client`](https://sdk-docs.sogni.ai/) SDK with the public‑safe subset of Sogni's creative‑agent platform: hosted tool definitions, the contract registry, asset manifests, `RunRecord` types with redaction, skill‑runtime helpers, and JSON Schema artifacts for cross‑language codegen.

For most agent builders this is the recommended starting point. Designed for third‑party integrations, downstream SDKs, and orchestration frameworks (n8n, LangChain, Anthropic skills, custom runtimes). Drives the same contracts and tool surface that the hosted `POST https://api.sogni.ai/v1/chat/completions`, `/v1/chat/runs`, and `/v1/creative-agent/workflows` endpoints use, so a client‑side agent loop stays shape‑locked with the server.

## Which package should I install?

| You're building… | Install |
|---|---|
| Custom AI agent that calls Sogni tools, validates LLM tool arguments, manages asset references | **`@sogni-ai/sogni-intelligence-client`** (recommended) |
| Thin wrapper that only generates an image/video/audio from a single direct call | [`@sogni-ai/sogni-client`](https://www.npmjs.com/package/@sogni-ai/sogni-client) (raw SDK) |
| n8n workflow node | **`@sogni-ai/sogni-intelligence-client`** (n8n compat helpers preserved) |
| Anthropic‑style Claude Skill, OpenClaw plugin, Hermes / Manus agent | [`@sogni-ai/sogni-creative-agent-skill`](https://github.com/Sogni-AI/sogni-creative-agent-skill) (consumes intelligence‑client under the hood) |

## Installation

```bash
npm install @sogni-ai/sogni-intelligence-client
```

Requires Node.js ≥ 18.

## Package structure

The package exposes the following subpath entry points so consumers import only what they need:

| Subpath | Purpose |
|---|---|
| `@sogni-ai/sogni-intelligence-client` | `SogniClientWrapper` connection class + helpers + re‑exports from the underlying SDK |
| `…/contracts` | Public contracts, default policies, repair recipes, prompt contracts, schema registry |
| `…/tools` | Sogni‑hosted tool definitions and argument validators (image, video, audio, editing, analysis) |
| `…/replay` | `RunRecord` types + redaction utilities (signed URLs, JWTs, bearer tokens scrubbed) |
| `…/runtime` | Contract runtime — apply policies, recipes, and prompt contracts at call sites |
| `…/public-skill-runtime` | Skill‑side helpers: classify turns, compile tool surface, dispatch tool calls |
| `…/skills/asset_reference_management` | Asset‑reference resolution helpers for hosted media |
| `…/workflows` | Creative‑workflow type definitions, bindings with embedded‑interpolation support, and a `primitives` namespace of pure helpers for `wf:*` stage tools (LLM judge + `__PASS__`/`__FAIL__` parser, bounded retry‑until‑predicate, storyboard script expander, dialogue duration fitter, SSRF allow‑list for fetched artifact URLs) |
| `…/media` | Media reference helpers (upload / download URL flows) |
| `…/chatRun` | Durable hosted `ChatRun` contracts — state machine, events, cost‑approval types |
| `…/context` | Context‑window primitives — token accounting, message protection, summarization budgeting |
| `…/openai-tools` | OpenAI‑shaped tool manifests (`app-tools.json`, `composition-tools.json`, `generation-tools.json`) baked into TS so consumers can compile a tool surface without filesystem reads |
| `…/skill-runtime-source` | Cross‑surface parity helpers (workflow status, Seedance audio windows) shared with the private skill runtime |
| `…/schemas/*` | Raw JSON Schema artifacts for cross‑language codegen (Swift, Kotlin, Python, etc.) |

Each subpath ships dual CJS + ESM with TypeScript declarations.

## Quick start

### 1. Configure credentials

Create a `.env` in your project root:

```env
SOGNI_USERNAME=your-username
SOGNI_PASSWORD=your-password
SOGNI_APP_ID=your-app-id        # optional; auto‑generated if omitted
SOGNI_NETWORK=fast              # or "relaxed"
```

### 2. Image generation

```typescript
import 'dotenv/config';
import { SogniClientWrapper } from '@sogni-ai/sogni-intelligence-client';

const client = new SogniClientWrapper({
  username: process.env.SOGNI_USERNAME!,
  password: process.env.SOGNI_PASSWORD!,
});

const model = await client.getMostPopularModel();

const result = await client.createProject({
  type: 'image',
  modelId: model.id,
  positivePrompt: 'A photorealistic portrait of a majestic lion at sunset',
  negativePrompt: 'blurry, cartoon, low quality',
  stylePrompt: 'cinematic',
  numberOfMedia: 1,
  steps: 30,
  guidance: 8,
});

console.log(result.images.map((i) => i.url));

await client.disconnect();
```

### 3. Tool calling against Sogni's hosted catalog

```typescript
import {
  SogniClientWrapper,
  SogniTools,
  isSogniToolCall,
} from '@sogni-ai/sogni-intelligence-client';

const client = new SogniClientWrapper({ /* … */ });

const chat = await client.chat.completions.create({
  model: 'openai/gpt-oss-120b',
  messages: [{ role: 'user', content: 'Generate a 3‑second clip of a koi pond.' }],
  tools: SogniTools.all,           // the full Sogni-hosted tool catalog
});

const call = chat.choices[0].message.tool_calls?.[0];
if (call && isSogniToolCall(call.function.name)) {
  // Hand the tool call off to Sogni's hosted execution surface, or
  // dispatch it locally via /public-skill-runtime.
}
```

### 4. Replay a previous run with redaction

```typescript
import {
  type RunRecord,
  redactRunRecord,
  redactPayload,
} from '@sogni-ai/sogni-intelligence-client/replay';

const safeRecord: RunRecord = redactRunRecord(originalRecord);
// Signed URLs, bearer tokens, JWTs, and inline secrets are scrubbed.
```

### 5. Validate a hosted‑tool argument blob

```typescript
import {
  validateAndNormalizeHostedToolArguments,
} from '@sogni-ai/sogni-intelligence-client/contracts';

const { ok, value, error } = validateAndNormalizeHostedToolArguments(
  'generate_image',
  { prompt: 'a serene koi pond', steps: 30 },
);
if (!ok) throw error;
// `value` is the normalized argument object ready to dispatch.
```

## Authentication

The wrapper accepts three authentication strategies through the `SogniClientConfig`:

```typescript
// Username/password
new SogniClientWrapper({ username, password });

// API key
new SogniClientWrapper({ apiKey });

// Token + cookies (typical for browser/edge contexts)
new SogniClientWrapper({ token, cookies });
```

Connection management, reconnection, and credit/balance polling are handled automatically. Call `client.disconnect()` when finished.

## Generation surfaces

The root wrapper exposes type‑safe project creation across every modality Sogni supports:

- **Image generation** — Stable Diffusion XL, Flux, full model marketplace.
- **Video generation** — WAN 2.2, LTX‑2.3, Seedance v2; workflows `t2v`, `i2v`, `s2v`, `ia2v`, `a2v`, `v2v`, `animate_move`, `animate_replace`.
- **Audio generation** — music and SFX models with cost estimation.
- **Image editing** — Qwen vision‑aware editors with multi‑reference context images.
- **Chat completions** — OpenAI‑shaped chat API against Sogni's LLM worker network. Streaming, vision (`image_url`), reasoning (`think`), and function/tool calling are first‑class.

See the [SDK docs](https://sdk-docs.sogni.ai/) for full parameter references on each surface.

## Contracts, tools, and skills

Sogni's hosted tool surface — `generate_image`, `generate_video`, `analyze_video`, `replace_video_segment`, and 20+ others — is described declaratively. Consumers can:

- Enumerate the catalog: `import { SogniTools } from '@sogni-ai/sogni-intelligence-client'`.
- Validate / normalize arguments before dispatch: `validateAndNormalizeHostedToolArguments` from `/contracts`.
- Apply gating policies, repair recipes, and prompt contracts at runtime: `createPublicSkillDefaultContractRuntime` from `/public-skill-runtime`.
- Generate JSON Schema clients for other languages from `/schemas/*`.
- Upscale a finished video without a prompt: `upscaleVideoDefinition` from `/tools` is the `upscale_video` tool (one generated or uploaded video, 1080p or 1440p, every frame and the audio kept), and `resolveVideoUpscaleOutput` / `validateVideoUpscaleSourceTiming` from `/media` derive the output size and check the public source limits before you submit.

For an end‑to‑end agent example, see the [Sogni Creative Agent Skill](https://github.com/Sogni-AI/sogni-creative-agent-skill) — the `sogni-agent` CLI plus a `SKILL.md` behavior file for Claude Code, OpenClaw, Hermes Agent, and Manus. It consumes only this package's public surface.

## RunRecord replay & redaction

`RunRecord` is the canonical JSON representation of a Sogni run: tool calls, results, costs, audit trail, and timing. Useful for replay, post‑hoc audits, and offline analysis.

```typescript
import {
  type RunRecord,
  type RunRecordRound,
  type RunRecordToolCall,
  type RunRecordToolResult,
  emptyRunRecord,
  redactRunRecord,
  RUN_RECORD_SCHEMA_VERSION,
} from '@sogni-ai/sogni-intelligence-client/replay';
```

`redactRunRecord` / `redactPayload` scrub signed URLs, bearer tokens, JWTs, and inline secrets — call them before persisting or logging records.

## Error handling

Errors are typed for precise dispatch:

```typescript
import {
  SogniError,
  SogniConnectionError,
  SogniAuthenticationError,
  SogniProjectError,
  SogniTimeoutError,
  SogniBalanceError,
  SogniValidationError,
  SogniConfigurationError,
  SogniModelNotFoundError,
  SogniNetworkError,
} from '@sogni-ai/sogni-intelligence-client';
```

Each error carries `cause` and a typed `data` field where applicable.

## TypeScript & module formats

- Written in TypeScript; full `.d.ts` declarations ship for every subpath.
- Dual CJS + ESM builds (`require()` and `import` both work).
- `moduleResolution: 'node'` and `'bundler'` both supported; `'node16'` / `'nodenext'` consumers should prefer the `import` condition.

## Migrating from `@sogni-ai/sogni-client-wrapper`

If you previously installed `@sogni-ai/sogni-client-wrapper`, the import path is the only thing that changes:

```diff
- import { SogniClientWrapper } from '@sogni-ai/sogni-client-wrapper';
+ import { SogniClientWrapper } from '@sogni-ai/sogni-intelligence-client';
```

All wrapper APIs are preserved at the root export. The intelligence client adds the new subpaths above; adopt them incrementally. The old `@sogni-ai/sogni-client-wrapper` npm name is deprecated.

## Related packages and docs

| | Where |
|---|---|
| **Intelligence Client docs** | https://sdk-docs.sogni.ai/our-superapps/sogni-sdk/intelligence-client/ |
| **Sogni Intelligence API** | https://sdk-docs.sogni.ai/sogni-intelligence/introduction/ |
| **`@sogni-ai/sogni-client`** (raw SDK) | [npm](https://www.npmjs.com/package/@sogni-ai/sogni-client) · [docs](https://sdk-docs.sogni.ai/) |
| **`@sogni-ai/sogni-creative-agent-skill`** (CLI + Anthropic skill) | [GitHub](https://github.com/Sogni-AI/sogni-creative-agent-skill) · [npm](https://www.npmjs.com/package/@sogni-ai/sogni-creative-agent-skill) |
| **SogniKit** (Swift, regenerated from `/schemas/*.json`) | https://github.com/Sogni-AI/SogniKit |
| `@sogni/creative-agent` (private) | Server‑side orchestration, billing enforcement, persona management. Not on npm. |

## Testing

```bash
npm test            # unit + type checks; no credentials required
npm run test:e2e    # full end-to-end, requires SOGNI_USERNAME/SOGNI_PASSWORD in .env
```

## License

MIT — see [LICENSE](./LICENSE).
