# Ezra Plugin Modernization — Design Spec

- **Date:** 2026-06-01
- **Status:** Approved (pending spec review)
- **Author:** Shlomi Hod (with Claude)

## Context & motivation

Ezra is a Claude Code plugin (MCP server + two skills + a React/TipTap editor) currently at
version `0.1.0`. A verified research sweep of the Claude / Claude Code / MCP ecosystem
(state as of 2026-06-01) found that Ezra is already current on the highest-stakes items but
is missing some matured MCP capabilities and is several major versions behind on its
dependencies.

What the research **confirmed Ezra already does right** (no action):

- `@modelcontextprotocol/sdk` `^1.29.0` is the latest **stable** release (v2 is alpha-only,
  not on npm). No SDK upgrade.
- Tool errors already return `isError: true` (`server/src/mcp.ts`).
- `.mcp.json` stdio config, plugin MCP tool-ID naming (`mcp__plugin_ezra_ezra__*`), and
  `allowed-tools` coverage are all correct.
- No hardcoded Claude model IDs anywhere.

What it **refuted** (claims that turned out to be optional/false, so excluded here):

- Tool annotations are **advisory hints, not mandatory**, and do not cause tool-call
  rejection.
- Declaring `skills` / `mcpServers` in `plugin.json` is **optional** (both auto-discovered).
- The suggested `$schema` URL for `plugin.json` appears fabricated.

The installed SDK (`1.29.0`) marks the old `server.tool(...)` signature as
`@deprecated Use registerTool instead`, and exposes:

```ts
registerTool(name, {
  title?, description?, inputSchema?, outputSchema?, annotations?, _meta?
}, cb): RegisteredTool
```

The tool callback "should return `structuredContent` if the tool has an `outputSchema`
defined, `content` if not — both fields are optional but typically one should be provided."
This confirms we can add `outputSchema`/`structuredContent` while still returning text for
backwards-compatibility and display.

## Goals

1. Adopt matured MCP capabilities Ezra doesn't yet use: modern `registerTool` API, tool
   annotations, and structured tool output.
2. Polish skill/plugin metadata to current authoring conventions.
3. Bring all dependencies up to their current major versions.

## Non-goals (explicitly out of scope)

- MCP resources / `resource_link` (exposing docs as `@`-mentionable resources).
- MCP SDK v2 (alpha-only, not on npm).
- MCP 2026-07-28 RC features (stateless core, Tasks, MCP Apps).
- Plugin hooks or agents/subagents.
- Pinning a `model:` in skill frontmatter.
- **Any version bump.** `plugin.json`, the `McpServer` version string, and workspace
  `package.json` versions all stay at `0.1.0` (explicit user decision).

## Constraints

- **Keep `0.1.0` everywhere.** No version changes.
- Per `CLAUDE.md`: after every change, write/update tests, run `npm test`, run `npm run build`.
- Confirm exact latest dependency versions via `npm` at implementation time — the researched
  numbers below are approximate and must be re-checked.
- Follow existing code patterns (ESM, the `toolHandler`/`textHandler` wrapper style, vitest).

## Delivery plan

Three isolated PRs, in dependency order. Each is independently reviewable and verified
before the next begins.

1. **PR 1 — Dependency upgrades** (establishes the new baseline)
2. **PR 2 — MCP tool modernization** (written against the new deps)
3. **PR 3 — Skill & plugin metadata polish**

**Rationale for the order:** zod 4 and TypeScript 6 land first so PR 2's tool rewrite is
authored against the final versions (no rework). The riskiest changes (react/vite) are
isolated in PR 1 and verified before any feature work.

---

## PR 1 — Dependency upgrades

Bump all dependencies to their current major versions. Apply per-cluster, running
`npm test` + `npm run build` after each cluster and fixing breakages before moving on.

**Server (`server/package.json`):**

| Package | From | To (approx — confirm via npm) | Watch for |
|---|---|---|---|
| `zod` | `^3.25` | `^4` | error/message customization API changes; `.parse` error shape |
| `express` | `^4.22` | `^5` | `path-to-regexp` v5 route patterns, middleware error handling. Fixes the existing `@types/express ^5` vs runtime-v4 mismatch. |
| `better-sqlite3` | `^11.8` | `^12` | native module — confirm prebuilt binary fetched on Node 22 (launcher `npm ci` path) |
| `jsdom` | `^28` | `^29` | HTML parsing edge cases in markdown/tracked-change tests |
| `open` | `^10` | `^11` | smoke-test `ezra_open` launching a browser tab |
| `typescript` | `^5.9` | `^6` | newly-flagged type errors; removed compiler options in `tsconfig` |

**Client (`client/package.json`):**

| Package | From | To (approx — confirm via npm) | Watch for |
|---|---|---|---|
| `react`, `react-dom` (+ `@types/*`) | `^18.3` | `^19` | React 19 codemods (forwardRef/defaultProps); TipTap 3 compatibility with React 19 |
| `vite` | `^6.4` | `^8` | config/option changes across v7→v8, Rolldown bundler defaults |
| `@vitejs/plugin-react` | `^4.7` | `^6` | coupled with the vite bump |
| `jsdom` | `^28` | `^29` | test env |
| `typescript` | `^5.9` | `^6` | as above |

**Verification (PR 1):**

- `npm test` (server + client) green.
- `npm run build` clean (both workspaces).
- Launch the app (server + client), confirm: the document list loads, the editor opens a
  document, tracked changes (insertions/deletions) and comment threads render, and one MCP
  round-trip works (e.g. `ezra_import` → `ezra_open` → `ezra_suggest`).
- `npm run test:e2e` (Playwright) green.

---

## PR 2 — MCP tool modernization

Scope: `server/src/mcp.ts` (+ tests). Migrate all 16 tools from the deprecated
`server.tool(name, desc, shape, handler)` to `server.registerTool(name, config, handler)`,
adding annotations and structured output.

### 2a. registerTool migration

For each tool, move to:

```ts
server.registerTool("ezra_list", {
  description: "...",
  inputSchema: { /* the existing zod raw shape */ },
  outputSchema: { /* see 2c, where applicable */ },
  annotations: { /* see 2b */ },
}, handler);
```

The existing zod raw-shape objects become `inputSchema`. Tools with no inputs (`ezra_list`)
pass `inputSchema: {}` or omit it.

### 2b. Tool annotations

Add `annotations` to every tool. `openWorldHint: false` on all (closed local domain).
Only the hints that apply are set; defaults cover the rest.

| Tool | readOnlyHint | destructiveHint | idempotentHint |
|---|:---:|:---:|:---:|
| `ezra_list` | true | — | — |
| `ezra_read` | true | — | — |
| `ezra_threads` | true | — | — |
| `ezra_changes_since` | true | — | — |
| `ezra_open` | — | false | true |
| `ezra_create` | — | false | false |
| `ezra_import` | — | false | false |
| `ezra_duplicate` | — | false | false |
| `ezra_suggest` | — | false | false |
| `ezra_comment` | — | false | false |
| `ezra_reply` | — | false | false |
| `ezra_resolve` | — | false | true |
| `ezra_edit` | — | true | false |
| `ezra_write` | — | true | false |
| `ezra_accept` | — | true | true |
| `ezra_reject` | — | true | true |

Notes: `ezra_open` has a side effect (sets the doc's open state / opens a browser tab) so it
is not read-only, but it is non-destructive and idempotent. `ezra_suggest`/`ezra_comment`/
`ezra_reply` *add* data (not destructive) but are not idempotent (re-running adds another
suggestion/comment). `ezra_accept`/`ezra_reject` modify document content (destructive) but
re-applying the same accept/reject is a no-op (idempotent).

### 2c. Structured output

Add `outputSchema` + return `structuredContent` for the tools that return structured data
today via `JSON.stringify`. `structuredContent` must be a JSON **object**, so array results
are wrapped:

| Tool | structuredContent shape |
|---|---|
| `ezra_list` | `{ documents: [...] }` |
| `ezra_threads` | `{ threads: [...] }` |
| `ezra_changes_since` | `{ operations: [...], next_cursor: number }` (already an object) |

Mutation tools that return a small result object (e.g. `ezra_create` → `{ doc_id }`,
`ezra_import`/`ezra_duplicate` → `{ doc_id }`, `ezra_edit`/`ezra_suggest` → operation result)
also get an `outputSchema` + `structuredContent` where the result is genuinely structured.
`ezra_read` stays **text** (markdown) — it is a document rendering, not structured data — so
it gets annotations but no `outputSchema`.

**Backwards-compatibility:** every tool continues to return `content: [{ type: "text", ... }]`
in addition to `structuredContent`. Where `outputSchema` is defined, the SDK validates
`structuredContent` against it, so the handler must always populate it.

### 2d. Wrapper changes

Update `toolHandler` / `textHandler` in `server/src/mcp.ts` so a handler can return both
`content` (text) and `structuredContent`. Keep the `errorResult` path (`isError: true`)
unchanged. Update the `McpServer` instantiation only as needed for the new API — **do not
change its `version: "0.1.0"`.**

### 2e. Tests (PR 2)

- Extend `server/src/__tests__/tools.test.ts` / `api.test.ts` to assert: each tool's
  annotations are present and correct; `outputSchema` tools return `structuredContent` that
  validates against the schema; text `content` is still returned for back-compat.
- `npm test` + `npm run build` green.

---

## PR 3 — Skill & plugin metadata polish

Lightweight, no version changes.

### 3a. Skill frontmatter (`skills/review/SKILL.md`, `skills/workshop/SKILL.md`)

- Add `when_to_use:` describing trigger phrases (e.g. for `review`: "reviewing a document,
  giving feedback, checking a draft/contract/proposal for issues"; for `workshop`: "opening a
  document for the user to edit collaboratively, then acting on their changes/comments").
- Add `argument-hint:` showing expected args (e.g. `<document or file> — <what to do>`).
- Convert `allowed-tools` from the single comma-separated string to a YAML list (functionally
  equivalent, more readable). Preserve the exact same tool IDs.

### 3b. CLAUDE.md

- Verify `claude plugin validate` exists in the current CLI. **Only if it does**, add a line
  to the Testing/After-every-change section: `claude plugin validate .` (validates
  `plugin.json`, skill frontmatter, component structure). If it does not exist, skip silently.

### 3c. Verification (PR 3)

- `npm test` + `npm run build` green (no functional code changed, but run per `CLAUDE.md`).
- `claude plugin validate .` passes (if available).
- Skills still load and `/review` / `/workshop` invoke correctly.

---

## Risks & mitigations

- **React 19 + TipTap 3 / vite 8** is the highest-risk cluster → isolated in PR 1, gated on
  app-launch + e2e verification, not just unit tests.
- **express 5** route/middleware changes → covered by supertest API tests; audit routes in
  `app.ts`/`mcp.ts` for wildcard patterns.
- **zod 4** error API changes could affect tool input validation messages → covered by tool
  tests; this is also why zod 4 lands before the PR 2 rewrite.
- **Annotation misclassification** is low-impact (advisory only) and easily adjusted.

## Open items to confirm at implementation time

1. Exact latest version of every dependency (via `npm view` / `npm outdated`).
2. Whether `claude plugin validate` exists in the installed CLI (gates PR 3b).
3. TipTap 3's official React 19 compatibility (gates the React bump in PR 1).
4. Final list of mutation tools that warrant an `outputSchema` vs. text-only (PR 2c).
