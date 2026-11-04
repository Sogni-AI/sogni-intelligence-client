# AGENTS.md

Guidance for coding agents (Claude Code, Codex CLI, etc.) working in this repo.
README.md is the public-facing intro — this file is the agent-facing map.

## Overview

`@sogni-ai/sogni-intelligence-client` is the public, mid-tier Node.js client for
the Sogni Supernet. It bundles two surfaces:

1. **The wrapper** (`src/client/SogniClientWrapper.ts`) — a hardened convenience
   layer over `@sogni-ai/sogni-client`: connection lifecycle, reconnection,
   promise-shaped project creation, typed errors, event emission.
2. **The public-safe subset of `@sogni/creative-agent`** — contracts, hosted
   tool definitions and validators, `RunRecord` replay + redaction, the
   public skill runtime, creative-workflow types + primitives, and JSON Schema
   artifacts for cross-language codegen. This is the surface allowed to leave
   the building; anything internal stays in the private `sogni-creative-agent`
   repo.

The package is consumed by `sogni-chat`, `sogni-api`, `sogni-creative-agent`,
`sogni-creative-agent-skill`, `sogni-vibe`, and `n8n-nodes-sogni`. It ships
dual CJS + ESM with TypeScript declarations across every subpath.

## Build & development commands

```bash
npm install              # install deps
npm run codegen          # regenerate openai-tools JSON manifests (also runs as prepare)
npm run build            # codegen + tsc (CJS) + tsc -p tsconfig.esm.json (ESM)
                         #   + write-esm-package-json + copy-openai-tools-json
                         #   + copy-schemas-json
npm run build:watch      # tsc --watch (CJS only)
npm run dev              # alias for build:watch

npm test                 # unit + type checks (test/basic-tests.ts, no creds)
npm run test:e2e         # full e2e — requires SOGNI_USERNAME/SOGNI_PASSWORD in .env
npm run test:e2e:llm     # narrow e2e scope to LLM/chat surface
npm run typecheck:examples   # tsc --noEmit -p tsconfig.examples.json
npm run test:examples    # alias for typecheck:examples
npm run test:all         # test + test:examples + test:e2e

npm run prepublishOnly   # runs build — fires before npm publish
```

The build is dual-target: `tsc` emits CJS to `dist/`, `tsc -p tsconfig.esm.json`
emits ESM to `dist-esm/`, and three small scripts in `scripts/` post-process the
output (write the ESM `package.json` stub, copy the openai-tools JSON
manifests into `dist/openai-tools/`, copy `schemas/*.json` into `dist/schemas/`).
`scripts/generate-openai-tools-manifests.mjs` builds the JSON manifests from
`src/tools/definitions` and bakes them into `_manifests.generated.ts` so the
ESM build resolves cleanly in Node 22 without filesystem reads.

## Directory structure

```
src/
  index.ts                     — root barrel; re-exports wrapper + public surface
  client/SogniClientWrapper.ts — connection lifecycle, project creation, chat
  types/                       — public type definitions + ClientEvent enum
  utils/                       — error classes, helpers (retry/waitFor/etc.)

  contracts/                   — public contracts: registry, gating policies,
                                 repair recipes, prompt contracts, hosted-tool
                                 validation, backbone/durable workflow types,
                                 composition/storyboard/music/video contracts
  tools/                       — hosted tool definitions + arg normalizers;
                                 shared/ holds prompt sanitizer, policy checks,
                                 dynamic-prompt + multi-image-intent helpers,
                                 number-of-variations alignment, etc.
  replay/                      — RunRecord types, schema version, emptyRunRecord,
                                 redactRunRecord/redactPayload
  runtime/                     — contract runtime, durable-workflow client,
                                 chat types
  public-skill-runtime/        — turn classifier, tool-surface compiler,
                                 dispatcher (createPublicSkillDefaultContractRuntime)
  workflows/                   — creative-workflow templates, bindings (with
                                 embedded interpolation), executor + ports,
                                 validation, summarizer, primitives namespace
  chatRun/                     — durable hosted ChatRun contracts + cost approval
  context/                     — context-window primitives (token accounting,
                                 message protection, summary budgeting)
  openai-tools/                — OpenAI-shaped manifests (app/composition/
                                 generation tools) baked into TS
  prompt-guides/               — model prompt rules per family and mode (moved
                                 from creative-agent's shaper), registry, lookup
                                 and rendering for agents and prompt writers
  skill-runtime-source/        — cross-surface parity helpers shared with the
                                 private skill runtime (published as source)
  skills/asset_reference_management/  — SKILL.md + asset manifest tools
  media/                       — media reference helpers (aspect ratio, audio/
                                 video/image references, music/video settings)
  schemas/                     — raw JSON Schema artifacts for cross-language
                                 codegen (.json files copied verbatim)

contracts/, replay/, runtime/, tools/, workflows/, media/, public-skill-runtime/,
chatRun/, context/, openai-tools/   — top-level legacy-resolution stubs that
                                       re-export from dist/* so older
                                       `moduleResolution` settings keep working

test/                        — basic-tests.ts (no creds), e2e-test.ts,
                               tools-shared-tests.ts, test-per-image-events.ts
examples/                    — runnable consumer-facing examples (llm-chat-*,
                               llm-tool-calling-*, simple-test). Type-checked
                               via tsconfig.examples.json.
scripts/                     — build post-processors and codegen
```

## Key tooling / integrations

- **`@sogni-ai/sogni-client`** — the underlying SDK (currently pinned at
  `5.0.0-alpha.6`). This repo depends on the SDK directly; keep the pin
  aligned with the published SDK release consumed by downstream repos.
- **`sharp`** — runtime dep for image dimension probing in media helpers.
- **`tsx`** — used to run TypeScript tests via `node --import tsx`.
- **OpenAI-shaped tool calling** — `SogniTools.all` (re-exported from the SDK)
  is the canonical hosted catalog. Use `isSogniToolCall` to discriminate hosted
  vs caller-defined tool calls, and `validateAndNormalizeHostedToolArguments`
  from `./contracts` to validate args before dispatch.

## Subpath entry points

Add new public surface area as a dedicated subpath, not as an addition to the
root barrel. Every subpath needs four touches:

1. `src/<name>/index.ts` — the barrel.
2. `package.json` `exports."./<name>"` — types + import + require + default.
3. `package.json` `typesVersions."*"."<name>"` — points at the .d.ts.
4. `package.json` `files` — include the top-level legacy-resolution stub
   directory if one exists (or add a new stub directory that re-exports
   from `dist/<name>`).

Verify dual-build output after adding a subpath: `npm run build` and confirm
both `dist/<name>/index.js` and `dist-esm/<name>/index.js` are emitted.

## Agent-specific guidance

- **Don't reinvent.** Check `src/tools/shared/`, `src/contracts/`, and
  `src/utils/helpers.ts` before adding utilities. `sogni find-utility
  "<query>"` scans this repo prominently. If a helper exists, import it.
- **Don't break the public surface.** Anything exported from a subpath is a
  consumer contract — `sogni-chat`, `sogni-api`, and `n8n-nodes-sogni` all
  depend on it. Removing or renaming a public symbol is a breaking change;
  coordinate it with a semver-major release and downstream consumer bumps.
- **Don't bypass redaction.** `RunRecord` data must pass through
  `redactRunRecord` / `redactPayload` from `./replay` before being persisted
  or logged. Signed URLs, bearer tokens, and JWTs leak otherwise.
- **Don't hand-format asset reference tokens.** Use
  `map_assets_for_model` from `src/skills/asset_reference_management/` —
  per-model formats are documented in that SKILL.md.
- **Validate hosted-tool args before dispatch.** Use
  `validateAndNormalizeHostedToolArguments` from `./contracts` rather than
  passing raw LLM output through.
- **Publishing is automatic.** Pushes to `main` run `.github/workflows/release.yml`
  and `semantic-release`, publishing to npm's `latest` dist-tag. Use
  Conventional Commits intentionally: `feat:` creates a minor release, `fix:`
  creates a patch release, and breaking changes create a major release. The
  release workflow currently uses `NPM_TOKEN`; for CI publish it must be an npm
  token that can publish without an interactive OTP.
- **Commits are strict.** Run `sogni commit-check sogni-intelligence-client -F
  <msg-file>` before committing. The rules match `sogni-client`: Conventional
  Commits, subject >= 16 characters, body required, blank line after subject,
  max 120 characters per line.
- **Examples must typecheck.** When adding or changing a public symbol,
  run `npm run typecheck:examples` — `examples/` is part of the test
  signal.

## Cross-repo context

> This repo is part of the Sogni ecosystem. The canonical card lives at
> `~/Documents/git/sogni-agent-knowledge/repos/sogni-intelligence-client.md`.
> Use the `sogni` CLI for cross-repo queries; the `sogni-knowledge` Skill
> handles publishing, bumping, and commit-rule workflows.
