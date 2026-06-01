# Ezra Plugin Modernization — Design Spec

- **Date:** 2026-06-01
- **Status:** Approved (revised after adversarial multi-agent review)
- **Author:** Shlomi Hod (with Claude)

## Context & motivation

Ezra is a Claude Code plugin (MCP server + two skills + a React/TipTap editor) currently at
version `0.1.0`. A verified research sweep (state as of 2026-06-01) plus an adversarial
multi-agent review of an earlier draft of this spec shaped the plan below.

What is **already current / correct** (no action):

- `@modelcontextprotocol/sdk` `^1.29.0` is the latest **stable** release (v2 is alpha-only,
  not on npm). No SDK upgrade.
- Tool errors already return `isError: true` (`server/src/mcp.ts`).
- `.mcp.json` stdio config, plugin MCP tool-ID naming (`mcp__plugin_ezra_ezra__*`), and
  `allowed-tools` coverage are all correct.
- No hardcoded Claude model IDs anywhere.

**Verified non-blockers** (claims that were investigated and *rejected*, so they do not gate
the work):

- SDK `1.29.0` **is** compatible with zod 4 — its `peerDependencies` are
  `"zod": "^3.25 || ^4.0"` and it ships a runtime compat layer (empirically tested green).
- TipTap 3 (`@tiptap/react`) **does** support React 19 — peer-deps include `^19.0.0` and the
  changelog confirms it.

What it **refuted as optional/false** (excluded here): tool annotations are advisory hints,
not mandatory; declaring `skills`/`mcpServers` in `plugin.json` is optional (auto-discovered);
the suggested `$schema` URL appears fabricated.

The installed SDK marks the old `server.tool(...)` signature `@deprecated Use registerTool`
and exposes `registerTool(name, { title?, description?, inputSchema?, outputSchema?,
annotations? }, cb)`.

## Goals

1. Bring all dependencies up to their current major versions.
2. Adopt the modern `registerTool` API and tool annotations (MCP hygiene / future-proofing).
3. Polish skill/plugin metadata to current authoring conventions.

## Non-goals (explicitly out of scope)

- **Structured tool output** (`outputSchema` / `structuredContent`). Cut as YAGNI: Ezra's
  tools already return JSON-as-text, the only MCP consumer is Claude (via the skills), and
  there is no non-LLM/programmatic consumer that would use a typed channel. Revisit only if
  such a consumer appears.
- MCP resources / `resource_link`.
- MCP SDK v2 (alpha-only, not on npm) and MCP 2026-07-28 RC features.
- Plugin hooks or agents/subagents.
- Opting into the React Compiler (pulled in as a `@vitejs/plugin-react@6` option — not worth
  it for an editor this size).
- Pinning a `model:` in skill frontmatter.
- **Any version bump.** `plugin.json`, the `McpServer` version string, and workspace
  `package.json` versions stay at `0.1.0` (hard user constraint).

## Constraints

- **Keep `0.1.0` everywhere.** No version changes.
- Per `CLAUDE.md`: after every change, write/update tests, run `npm test`, run `npm run build`.
- Confirm exact latest dependency versions via `npm` at implementation time — numbers below
  are approximate and must be re-checked.
- Follow existing code patterns (ESM, the `toolHandler`/`textHandler` wrappers, vitest).

## Delivery plan

Four isolated PRs. Dependencies first, split by blast radius (the review showed bundling
8+ majors across server **and** client into one PR lets a risky client breakage block the
trivially-safe server bumps).

1. **PR 1 — Server dependency upgrades** (low risk; includes the load-bearing express-5 fix)
2. **PR 2 — Client dependency upgrades** (the risky react/vite/TipTap cluster; app-verified)
3. **PR 3 — MCP tool modernization** (`registerTool` + annotations)
4. **PR 4 — Skill & plugin metadata polish**

**Ordering rationale (corrected):** the order is about **isolating dependency blast radius
and landing the new toolchain (zod 4 / TS 6) before the MCP rewrite touches tool schemas** —
*not* about avoiding zod-driven rework (the SDK accepts zod 3 or 4 shapes either way, so PR 3
does not strictly depend on PR 1).

**Rollback note (no version bump):** because the published version stays `0.1.0`, there is no
semver signal to roll back. If a merged change breaks installed users, recovery is a revert
commit on `main`; users pick it up when the plugin cache refreshes for `0.1.0`. Keep each PR
revertable in isolation.

---

## PR 1 — Server dependency upgrades

Scope: `server/package.json` (+ `server/src/app.ts`, tests). Apply per-cluster; run
`npm test` + `npm run build` after each and fix breakages before moving on.

| Package | From | To (approx — confirm via npm) | Watch for |
|---|---|---|---|
| `zod` | `^3.25` | `^4` | **`.default()` fields now land in JSON-schema `required`** — verify the generated inputSchema for `ezra_changes_since` (`cursor`) and `ezra_import` (`format`); add `.optional()` / restructure if they become required. Error/message API changes. |
| `express` | `^4.22` | `^5` | **path-to-regexp v8 breaking change — see required fix below.** Middleware error handling; helmet/cors behavior under v5. |
| `better-sqlite3` | `^11.8` | `^12` | native module — confirm a prebuilt binary is fetched on Node 22 (see clean-spawn check) |
| `jsdom` | `^28` | `^29` | HTML parsing edge cases in markdown/tracked-change tests |
| `open` | `^10` | `^11` | smoke-test `ezra_open` |
| `typescript` | `^5.9` | `^6` | review **both** `tsconfig.json` for removed/deprecated options (`baseUrl`, `downlevelIteration`); use `ignoreDeprecations: "6.0"` if needed |
| `@types/node`, `@types/better-sqlite3`, `@types/jsdom` | current | align with runtime majors | type mismatches after the bumps |
| `@tiptap/core`, `@tiptap/starter-kit`, `tiptap-markdown` (server) | `^3.22`, `^0.9` | latest 3.x / evaluate | server-side markdown round-tripping; `markdown.test.ts` is the guard |
| **root** `@playwright/test` | `^1.59` | bump or explicitly hold | CI `playwright install` step |

**REQUIRED express-5 fix (CRITICAL — would otherwise crash the server at startup):**
`server/src/app.ts:189` is `app.get("*", ...)` (the SPA fallback). Under express 5 a bare `*`
throws `TypeError: Missing parameter name at position 1` **at `createApp()` time**, before the
server listens. Change it to `app.get("/{*splat}", ...)` (braces, so it still matches `/`).

**Test-coverage gap (must address):** the real `app.ts` is exercised by **zero** unit tests —
`api.test.ts` builds its own inline express app (no helmet, no wildcard route) and
`tools.test.ts`/`open.test.ts` mock `app.js`. The spec's earlier "covered by supertest" claim
was false. Add a **startup smoke test** that imports and calls `createApp()` and asserts it
does not throw (catches the wildcard/route-syntax break deterministically, not via a 30s e2e
timeout).

**Verification (PR 1):**

- `npm test --workspace=server` + `npm run build` green.
- New `createApp()` smoke test green.
- **Clean-spawn check** (validates the launcher's exact path + the native binary):
  `rm -rf node_modules server/node_modules node_modules/.ezra-built` then a fresh `npm ci` +
  `npm run build` — confirm `better-sqlite3` resolves a prebuilt binary on Node 22 with no
  source-build fallback.

---

## PR 2 — Client dependency upgrades

Scope: `client/package.json` (+ `client/vite.config.ts`, tests). The highest-risk cluster —
gated on real app launch, not just unit tests.

| Package | From | To (approx — confirm via npm) | Watch for |
|---|---|---|---|
| `react`, `react-dom` (+ `@types/react`, `@types/react-dom`) | `^18.3` | `^19` | React 19 codemods; StrictMode/ref behavior in the TipTap editor. (TipTap 3 React-19 support is **confirmed**, so this is a verification note, not a gate.) |
| `vite` | `^6.4` | `^8` | two-major jump; Rolldown bundler defaults (v8 ships a config compat layer); options changed across v7→v8 |
| `@vitejs/plugin-react` | `^4.7` | `^6` | peer deps (react-compiler / rolldown-babel) — **do not** enable React Compiler; confirm vite-8 compatible version |
| `jsdom` (dev) | `^28` | `^29` | test env |
| `typescript` | `^5.9` | `^6` | as PR 1 |

**Verification (PR 2):**

- `npm test --workspace=client` + `npm run build` green.
- **App launch:** start server + client; confirm the document list loads, the editor opens a
  document, tracked changes (insertions/deletions) and comment threads render, and one MCP
  round-trip works (`ezra_import` → `ezra_open` → `ezra_suggest`). Explicitly confirm the
  TipTap editor renders and accepts input under React 19 (no console errors).
- `npm run test:e2e` (Playwright) green.

---

## PR 3 — MCP tool modernization

Scope: `server/src/mcp.ts` (+ a new test). Migrate all 16 tools from the deprecated
`server.tool(name, desc, shape, handler)` to `server.registerTool(name, { description,
inputSchema, annotations }, handler)`, and add annotations.

**Honest framing (verified):** this is **MCP hygiene / future-proofing, not a user-facing
improvement**. Tool annotations do **not** change Claude Code CLI behavior — CLI MCP
permissions are governed by the `allowed-tools` allowlists the skills already declare, and
`readOnlyHint`-based auto-approval is an *unimplemented* feature request. Annotations benefit
Claude Desktop confirmation UX and a possible future Connectors Directory submission. The
`registerTool` migration only suppresses a deprecation tag (the old API still works at
runtime; v2 is out of scope). It is cheap and zero-risk, which is why it stays in.

### 3a. registerTool migration

The existing zod raw-shape objects become `inputSchema`. Tools with no inputs (`ezra_list`)
omit `inputSchema`. The `toolHandler`/`textHandler` wrappers stay as-is (they already return
`{ content: [{ type: "text", text }] }`, optionally `isError`) — **no structured output**.

### 3b. Tool annotations

`openWorldHint: false` on all tools (closed local domain). Only applicable hints are set.

| Tool | readOnlyHint | destructiveHint | idempotentHint |
|---|:---:|:---:|:---:|
| `ezra_list`, `ezra_read`, `ezra_threads`, `ezra_changes_since` | true | — | — |
| `ezra_open` | — | false | true |
| `ezra_create`, `ezra_import`, `ezra_duplicate`, `ezra_suggest`, `ezra_comment`, `ezra_reply` | — | false | false |
| `ezra_resolve` | — | false | false |
| `ezra_edit`, `ezra_write` | — | true | false |
| `ezra_accept`, `ezra_reject` | — | true | true |

Review corrections applied: `ezra_resolve` is **not** idempotent (a closing note has lasting
effect) → `idempotentHint: false`. `ezra_open` stays non-destructive (it changes which doc is
open / opens a tab; it does not destroy document data) — flagged by a reviewer as debatable,
but kept as non-destructive since these hints are advisory and low-stakes.

### 3c. Tests (PR 3)

The current tests do **not** exercise the MCP server layer at all (`tools.test.ts` calls the
underlying `ezra*` functions directly; nothing boots `createMcpServer()`). So "extend
tools.test.ts" is insufficient — add a **new `server/src/__tests__/mcp.test.ts`** that
instantiates `createMcpServer()` and asserts, via the registered tool definitions / a
`listTools` call (in-memory transport), that every tool is present and its annotations match
3b. `npm test` + `npm run build` green.

---

## PR 4 — Skill & plugin metadata polish

Lightweight, no version changes.

### 4a. Skill frontmatter (`skills/review/SKILL.md`, `skills/workshop/SKILL.md`)

- Add `when_to_use:` (trigger phrases) and `argument-hint:` (e.g. `<document or file> — <what
  to do>`). Confirm these keys are valid in the installed Claude Code before relying on them.
- Convert `allowed-tools` from the comma-separated string to a YAML list (same tool IDs).

### 4b. CLAUDE.md & README

- Verify `claude plugin validate` exists in the installed CLI (`claude plugin --help`).
  **Only if it does**, add `claude plugin validate .` to the test workflow; else skip.
- Update the README MCP-tools table / `ezra_read` wording if any tool description text changed
  in PR 3 (own the README drift here so it doesn't go stale).

### 4c. Verification (PR 4)

- `npm test` + `npm run build` green.
- `claude plugin validate .` passes (if available).
- `/review` and `/workshop` still load and invoke correctly.

---

## Risks & mitigations

- **react 19 + vite 8 + TipTap** — isolated in PR 2, gated on app-launch + e2e (not just unit
  tests). React 19 is the only major with no functional benefit to Ezra, but TipTap-on-React-19
  is confirmed supported; risk is runtime/StrictMode behavior, caught by e2e.
- **express 5 `app.get("*")`** — a hard startup crash; addressed by the explicit `/{*splat}`
  fix + the new `createApp()` smoke test (the old supertest suite never ran the real app).
- **zod 4 input-schema shift** (`.default()` → `required`) — verified per-tool in PR 1.
- **better-sqlite3 v12 native build** — validated via the clean-spawn `npm ci` check on Node 22.
- **Annotation misclassification** — advisory only, low-impact, easily adjusted.

## Open items to confirm at implementation time

1. Exact latest version of every dependency (`npm view` / `npm outdated`).
2. Whether `claude plugin validate` and the `when_to_use` / `argument-hint` SKILL.md keys
   exist in the installed Claude Code (gate PR 4).
3. The `better-sqlite3` v12 prebuilt-binary outcome on the actual Node 22 / OS (clean-spawn).
4. Whether CI (`.github/workflows/ci.yml`) needs any change (Node version, `playwright install`).
