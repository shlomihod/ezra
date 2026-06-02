# Ezra Plugin Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the Ezra Claude Code plugin: upgrade all dependencies to current majors, migrate MCP tools to the `registerTool` API with annotations, and polish skill/plugin metadata — without changing the `0.1.0` version.

**Architecture:** Four independent PRs, each its own branch off `main`, each independently verified before the next. Order isolates dependency blast radius (server deps → client deps) and lands the new toolchain before the MCP rewrite. Spec: `docs/superpowers/specs/2026-06-01-ezra-plugin-modernization-design.md`.

**Tech Stack:** Node 22, TypeScript, ESM, `@modelcontextprotocol/sdk ^1.29.0`, Express, better-sqlite3, zod, React 18→19, TipTap 3, Vite 6→8, vitest, Playwright.

---

## Conventions for every task

- **Branch per PR:** before Phase N's first task, `git checkout main && git pull && git checkout -b <branch>`.
- **Confirm versions live:** the `@^X` targets below are approximate. Before each bump run e.g. `npm view zod version` and pin the real latest major.
- **Co-author line on every commit:** `Co-Authored-By: Claude <noreply@anthropic.com>` (repo convention — simple "Claude").
- **Never bump any `version` field** (`plugin.json`, `server/package.json`, `client/package.json`, `mcp.ts` `McpServer({ version })`).
- **Workspace commands:** `npm install <pkg>@<range> --workspace=server|client`; root deps install at repo root.

## File Structure

- `server/src/__tests__/startup.test.ts` — **NEW.** Guards that `createApp()` constructs without throwing (catches the express-5 route-syntax crash deterministically).
- `server/src/app.ts:189` — **MODIFY.** Wildcard route `*` → `/{*splat}` for express 5.
- `server/package.json`, `server/tsconfig.json` — **MODIFY.** Server dep bumps + tsconfig review.
- `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts` — **MODIFY.** Client dep bumps.
- `package.json` (root) — **MODIFY.** `@playwright/test` decision.
- `server/src/mcp.ts` — **MODIFY.** `server.tool(...)` → `server.registerTool(...)` + annotations for all 16 tools.
- `server/src/__tests__/mcp.test.ts` — **NEW.** Boots `createMcpServer()` over an in-memory transport and asserts tool presence + annotations.
- `skills/review/SKILL.md`, `skills/workshop/SKILL.md` — **MODIFY.** `when_to_use`, `argument-hint`, `allowed-tools` → YAML list.
- `CLAUDE.md`, `README.md` — **MODIFY.** Optional `claude plugin validate`; tool-table drift.

---

# Phase 1 — PR 1: Server dependency upgrades

Branch: `git checkout main && git checkout -b deps-server-majors`

### Task 1.1: Add a `createApp()` startup smoke test (guards the express-5 break)

**Files:**
- Create: `server/src/__tests__/startup.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { createApp } from "../app.js";
import { mountMcp } from "../mcp.js";

describe("createApp", () => {
  it("constructs app + server without throwing (route syntax is valid)", () => {
    expect(() => createApp()).not.toThrow();
  });

  it("constructs with the MCP mount hook without throwing", () => {
    expect(() => createApp({ beforeStaticFiles: (app) => mountMcp(app) })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it — expect PASS (still on express 4)**

Run: `npm test --workspace=server -- startup`
Expected: PASS (createApp works under express 4). This baseline proves the test is correct before it has to catch the express-5 regression.

- [ ] **Step 3: Commit**

```bash
git add server/src/__tests__/startup.test.ts
git commit -m "test(server): add createApp startup smoke test

Guards route-registration syntax; will catch the express 5
path-to-regexp break that no existing test exercises (api.test.ts
builds its own inline app).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 1.2: Bump zod to v4 and verify generated input schemas

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Pin and install the real latest v4**

Run: `npm view zod version` (note it), then
`npm install zod@^4 --workspace=server`

- [ ] **Step 2: Run server tests + build**

Run: `npm test --workspace=server && npm run build --workspace=server`
Expected: PASS. If failures mention `.parse`/error shape, adjust per the zod 4 error API.

- [ ] **Step 3: Check the `.default()` → `required` shift on tool input schemas**

zod 4 places fields with `.default()` into JSON-schema `required`. Two tool inputs use defaults: `ezra_changes_since` (`cursor: z.number().default(0)`) and `ezra_import` (`format: ...default("markdown")`) in `server/src/mcp.ts`.
Run the MCP test once it exists (Phase 3) — for now, eyeball: if a default field must remain optional to callers, change `z.number().default(0)` → `z.number().default(0).optional()` (or `z.number().optional()` with a handler-side default). Record any change here for Phase 3 to honor.

- [ ] **Step 4: Commit**

```bash
git add server/package.json package-lock.json
git commit -m "build(server): upgrade zod to v4

SDK 1.29 peer-deps accept zod ^3.25||^4.0 (compat layer). Verified
tests + build green.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 1.3: Bump express to v5 and fix the SPA wildcard route

**Files:**
- Modify: `server/package.json`, `server/src/app.ts:189`

- [ ] **Step 1: Install express 5 (and align `@types/express`)**

Run: `npm view express version`, then
`npm install express@^5 --workspace=server` and `npm install -D @types/express@^5 --workspace=server`

- [ ] **Step 2: Run the smoke test — expect FAIL**

Run: `npm test --workspace=server -- startup`
Expected: FAIL — `createApp()` throws `TypeError: Missing parameter name at position 1` because `app.get("*", ...)` is invalid under path-to-regexp v8.

- [ ] **Step 3: Fix the wildcard route**

In `server/src/app.ts`, change line 189 from:

```ts
  app.get("*", (_req, res) => {
```

to:

```ts
  app.get("/{*splat}", (_req, res) => {
```

(Braces make it match both `/` and nested paths; the body that calls `res.sendFile(...)` is unchanged.)

- [ ] **Step 4: Run the smoke test + full server suite — expect PASS**

Run: `npm test --workspace=server && npm run build --workspace=server`
Expected: PASS. If middleware error-handler signatures fail to compile, update them to the express 5 form.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/src/app.ts package-lock.json
git commit -m "build(server): upgrade express to v5, fix SPA wildcard route

path-to-regexp v8 rejects bare '*'; change the SPA fallback to
'/{*splat}'. Startup smoke test now passes under express 5.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 1.4: Bump better-sqlite3 to v12 and validate the native binary path

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install**

Run: `npm view better-sqlite3 version`, then
`npm install better-sqlite3@^12 --workspace=server` and `npm install -D @types/better-sqlite3@latest --workspace=server`

- [ ] **Step 2: Run server tests**

Run: `npm test --workspace=server`
Expected: PASS (db tests exercise better-sqlite3).

- [ ] **Step 3: Clean-spawn check (validates the launcher's exact path on Node 22)**

Run:
```bash
rm -rf node_modules server/node_modules client/node_modules node_modules/.ezra-built
npm ci && npm run build
```
Expected: install completes; `better-sqlite3` fetches a **prebuilt** binary for Node 22 (no `node-gyp` source compile). If it source-builds or fails, note it and consider pinning `^11` with a comment.

- [ ] **Step 4: Commit**

```bash
git add server/package.json package-lock.json
git commit -m "build(server): upgrade better-sqlite3 to v12

Verified prebuilt binary resolves on Node 22 via clean npm ci.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 1.5: Bump jsdom and open

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install**

Run: `npm install jsdom@^29 open@^11 --workspace=server`

- [ ] **Step 2: Test + build**

Run: `npm test --workspace=server && npm run build --workspace=server`
Expected: PASS (markdown/tracked-change tests use jsdom; `open.test.ts` mocks `open`).

- [ ] **Step 3: Commit**

```bash
git add server/package.json package-lock.json
git commit -m "build(server): upgrade jsdom to v29, open to v11

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 1.6: Bump TypeScript to v6 and review tsconfig

**Files:**
- Modify: `server/package.json`, `server/tsconfig.json`

- [ ] **Step 1: Install**

Run: `npm view typescript version`, then `npm install -D typescript@^6 --workspace=server`

- [ ] **Step 2: Build — capture deprecation/removal errors**

Run: `npm run build --workspace=server`
Expected: may error on removed/deprecated options (e.g. `baseUrl`, `downlevelIteration`).

- [ ] **Step 3: Fix tsconfig**

Read `server/tsconfig.json` and `tsconfig.base.json`. Remove or replace any option TS 6 flags. If a needed option is merely deprecated (not removed), add `"ignoreDeprecations": "6.0"` to `compilerOptions` as a temporary measure. Re-run the build until clean.

- [ ] **Step 4: Test + build green**

Run: `npm test --workspace=server && npm run build --workspace=server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/tsconfig.json tsconfig.base.json package-lock.json
git commit -m "build(server): upgrade TypeScript to v6, update tsconfig

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 1.7: Bump server-side TipTap, @types, and root @playwright/test

**Files:**
- Modify: `server/package.json`, root `package.json`

- [ ] **Step 1: Install server TipTap + remaining @types**

Run: `npm install @tiptap/core@latest @tiptap/starter-kit@latest tiptap-markdown@latest --workspace=server`
then `npm install -D @types/node@^22 @types/jsdom@^29 --workspace=server`
(If `@tiptap/*` latest is a new major, hold at `^3` instead and note it; `markdown.test.ts` is the guard.)

- [ ] **Step 2: Bump root playwright**

Run: `npm view @playwright/test version`, then `npm install -D @playwright/test@latest` (root). Run `npx playwright install` if the runner prompts for new browsers.

- [ ] **Step 3: Test + build green**

Run: `npm test --workspace=server && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/package.json package.json package-lock.json
git commit -m "build: upgrade server TipTap/@types and root playwright

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 1.8: PR 1 verification gate + open PR

- [ ] **Step 1: Full verification**

Run:
```bash
npm test
npm run build
rm -rf node_modules server/node_modules client/node_modules node_modules/.ezra-built && npm ci && npm run build
```
Expected: all green; clean install resolves all native deps on Node 22.

- [ ] **Step 2: Open PR**

```bash
git push -u origin deps-server-majors
gh pr create --title "Server dependency major upgrades" --body "zod 4, express 5 (+ SPA wildcard fix), better-sqlite3 12, TS 6, jsdom/open, server TipTap, @types, root playwright. Adds createApp startup smoke test. Version unchanged (0.1.0).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

# Phase 2 — PR 2: Client dependency upgrades

Branch (after PR 1 merges or off `main`): `git checkout main && git checkout -b deps-client-majors`

### Task 2.1: Bump React to 19

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1: Install**

Run: `npm install react@^19 react-dom@^19 --workspace=client`
then `npm install -D @types/react@^19 @types/react-dom@^19 --workspace=client`

- [ ] **Step 2: Test + build**

Run: `npm test --workspace=client && npm run build --workspace=client`
Expected: PASS. If `@testing-library/react` errors, ensure it is v16+ (already `^16.3.2`). Apply React 19 codemods only if a `forwardRef`/`defaultProps` warning surfaces in the editor components.

- [ ] **Step 3: Commit**

```bash
git add client/package.json package-lock.json
git commit -m "build(client): upgrade React to 19

TipTap 3 peer-deps include React 19. Tests + build green.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2.2: Bump Vite to 8 and @vitejs/plugin-react to 6

**Files:**
- Modify: `client/package.json`, `client/vite.config.ts`

- [ ] **Step 1: Install (coupled)**

Run: `npm view vite version` and `npm view @vitejs/plugin-react version`, then
`npm install -D vite@^8 @vitejs/plugin-react@^6 --workspace=client`

- [ ] **Step 2: Build — fix config**

Run: `npm run build --workspace=client`
Read `client/vite.config.ts`; if any option was renamed/removed across v7→v8 (Rolldown defaults), update it. **Do not** enable the React Compiler option that `@vitejs/plugin-react@6` exposes.

- [ ] **Step 3: Test + build green**

Run: `npm test --workspace=client && npm run build --workspace=client`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/package.json client/vite.config.ts package-lock.json
git commit -m "build(client): upgrade Vite to 8 and plugin-react to 6

React Compiler intentionally not enabled.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2.3: Bump client jsdom + TypeScript

**Files:**
- Modify: `client/package.json`, `client/tsconfig.json`

- [ ] **Step 1: Install**

Run: `npm install -D jsdom@^29 typescript@^6 --workspace=client`

- [ ] **Step 2: Build — review tsconfig (same as Task 1.6)**

Run: `npm run build --workspace=client`; fix `client/tsconfig.json` for any removed/deprecated TS 6 option.

- [ ] **Step 3: Test + build green; commit**

Run: `npm test --workspace=client && npm run build --workspace=client`

```bash
git add client/package.json client/tsconfig.json package-lock.json
git commit -m "build(client): upgrade jsdom to 29 and TypeScript to 6

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2.4: PR 2 verification gate (app launch + e2e) + open PR

- [ ] **Step 1: Unit + build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 2: Launch the app and verify the editor under React 19**

Run (two terminals): `npm run dev:server` and `npm run dev:client`. In the browser:
- the document list loads;
- opening a document shows the TipTap editor (no React 19 console errors);
- tracked-change insertions/deletions and comment threads render;
- an MCP round-trip works: drive `ezra_import` → `ezra_open` → `ezra_suggest` (via the running MCP server / a `/review` invocation) and confirm the suggestion appears.

- [ ] **Step 3: E2E**

Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 4: Open PR**

```bash
git push -u origin deps-client-majors
gh pr create --title "Client dependency major upgrades" --body "React 19, Vite 8 + plugin-react 6 (no React Compiler), jsdom 29, TS 6. Verified via app launch + e2e. Version unchanged (0.1.0).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

# Phase 3 — PR 3: MCP tool modernization (registerTool + annotations)

Branch: `git checkout main && git checkout -b mcp-registertool-annotations`

**Annotation map** (`openWorldHint: false` on every tool):

| Tool | readOnlyHint | destructiveHint | idempotentHint |
|---|:---:|:---:|:---:|
| ezra_list, ezra_read, ezra_threads, ezra_changes_since | true | — | — |
| ezra_open | — | false | true |
| ezra_create, ezra_import, ezra_duplicate, ezra_suggest, ezra_comment, ezra_reply | — | false | false |
| ezra_resolve | — | false | false |
| ezra_edit, ezra_write | — | true | false |
| ezra_accept, ezra_reject | — | true | true |

### Task 3.1: Write the failing MCP-server annotation test

**Files:**
- Create: `server/src/__tests__/mcp.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../mcp.js";

async function listTools() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  return tools;
}

describe("MCP tool registration", () => {
  it("registers all 16 ezra tools", async () => {
    const tools = await listTools();
    expect(tools.filter((t) => t.name.startsWith("ezra_"))).toHaveLength(16);
  });

  it("marks read tools readOnly + openWorldHint false", async () => {
    const tools = await listTools();
    for (const name of ["ezra_list", "ezra_read", "ezra_threads", "ezra_changes_since"]) {
      const t = tools.find((x) => x.name === name);
      expect(t?.annotations?.readOnlyHint, name).toBe(true);
      expect(t?.annotations?.openWorldHint, name).toBe(false);
    }
  });

  it("marks ezra_write / ezra_edit destructive (not read-only)", async () => {
    const tools = await listTools();
    for (const name of ["ezra_write", "ezra_edit"]) {
      const t = tools.find((x) => x.name === name);
      expect(t?.annotations?.destructiveHint, name).toBe(true);
      expect(t?.annotations?.readOnlyHint ?? false, name).toBe(false);
    }
  });

  it("marks ezra_accept idempotent and ezra_resolve non-idempotent", async () => {
    const tools = await listTools();
    expect(tools.find((x) => x.name === "ezra_accept")?.annotations?.idempotentHint).toBe(true);
    expect(tools.find((x) => x.name === "ezra_resolve")?.annotations?.idempotentHint ?? false).toBe(false);
  });
});
```

- [ ] **Step 2: Verify the import paths resolve**

Run: `node -e "require.resolve('@modelcontextprotocol/sdk/inMemory.js', { paths: ['server'] })"` from repo root. If it errors, find the correct subpath: `ls server/node_modules/@modelcontextprotocol/sdk/dist/esm | grep -i memory` and adjust the import (e.g. `.../sdk/inMemory.js` is the standard export).

- [ ] **Step 3: Run — expect FAIL**

Run: `npm test --workspace=server -- mcp`
Expected: FAIL — tools currently register via `server.tool(...)` with **no** annotations, so `annotations` is undefined and the assertions fail.

- [ ] **Step 4: Commit the failing test**

```bash
git add server/src/__tests__/mcp.test.ts
git commit -m "test(server): add MCP server-level annotation test (red)

First test to boot createMcpServer over an in-memory transport.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3.2: Migrate all 16 tools to registerTool + annotations

**Files:**
- Modify: `server/src/mcp.ts`

- [ ] **Step 1: Transform each registration**

Mechanically rewrite each `server.tool(name, description, shape, handler)` to:

```ts
server.registerTool(name, {
  description,            // the same string
  inputSchema: shape,     // omit this key entirely for ezra_list (no inputs)
  annotations: { /* from the map below */ },
}, handler);              // the existing toolHandler(...) / textHandler(...) — unchanged
```

The `toolHandler`/`textHandler`/`errorResult` wrappers and the `mountMcp` session code are **unchanged**. Do **not** add `outputSchema`/`structuredContent`. Per-tool `annotations` objects:

```ts
// read-only
ezra_list:           { readOnlyHint: true,  openWorldHint: false }
ezra_read:           { readOnlyHint: true,  openWorldHint: false }
ezra_threads:        { readOnlyHint: true,  openWorldHint: false }
ezra_changes_since:  { readOnlyHint: true,  openWorldHint: false }
// non-destructive state changes
ezra_open:           { destructiveHint: false, idempotentHint: true,  openWorldHint: false }
ezra_create:         { destructiveHint: false, idempotentHint: false, openWorldHint: false }
ezra_import:         { destructiveHint: false, idempotentHint: false, openWorldHint: false }
ezra_duplicate:      { destructiveHint: false, idempotentHint: false, openWorldHint: false }
ezra_suggest:        { destructiveHint: false, idempotentHint: false, openWorldHint: false }
ezra_comment:        { destructiveHint: false, idempotentHint: false, openWorldHint: false }
ezra_reply:          { destructiveHint: false, idempotentHint: false, openWorldHint: false }
ezra_resolve:        { destructiveHint: false, idempotentHint: false, openWorldHint: false }
// destructive
ezra_edit:           { destructiveHint: true,  idempotentHint: false, openWorldHint: false }
ezra_write:          { destructiveHint: true,  idempotentHint: false, openWorldHint: false }
ezra_accept:         { destructiveHint: true,  idempotentHint: true,  openWorldHint: false }
ezra_reject:         { destructiveHint: true,  idempotentHint: true,  openWorldHint: false }
```

Example — `ezra_list` (no inputs) before:

```ts
server.tool("ezra_list", "List all documents. Returns titles, IDs, and whether each is currently open in the browser.",
  {},
  toolHandler(() => ezraList(), true)
);
```

after:

```ts
server.registerTool("ezra_list", {
  description: "List all documents. Returns titles, IDs, and whether each is currently open in the browser.",
  annotations: { readOnlyHint: true, openWorldHint: false },
}, toolHandler(() => ezraList(), true));
```

Example — `ezra_write` (with inputs) after:

```ts
server.registerTool("ezra_write", {
  description: "Overwrite entire document content. Content is parsed as markdown. Use instead of ezra_edit when replacing all content or writing to an empty document.",
  inputSchema: {
    doc_id: z.string().describe("The document ID"),
    content: z.string().max(1_000_000).describe("The full document content as markdown. Replaces entire document."),
  },
  annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
}, toolHandler(({ doc_id, content }) => ezraWrite(doc_id, content)));
```

- [ ] **Step 2: Run the MCP test — expect PASS**

Run: `npm test --workspace=server -- mcp`
Expected: PASS (16 tools, annotations correct).

- [ ] **Step 3: Full server suite + build**

Run: `npm test --workspace=server && npm run build --workspace=server`
Expected: PASS. (Confirms the `registerTool` migration didn't change tool behavior; existing `tools.test.ts` still green.)

- [ ] **Step 4: Commit**

```bash
git add server/src/mcp.ts
git commit -m "refactor(server): migrate MCP tools to registerTool + annotations

All 16 tools moved off the deprecated server.tool() signature; adds
readOnly/destructive/idempotent hints (openWorldHint false throughout).
Advisory only — no Claude Code CLI behavior change. No structured output.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3.3: PR 3 verification + open PR

- [ ] **Step 1: Verify + push**

Run: `npm test && npm run build`

```bash
git push -u origin mcp-registertool-annotations
gh pr create --title "Modernize MCP tools: registerTool + annotations" --body "Migrates all 16 tools off the deprecated server.tool() API to registerTool, adds advisory tool annotations, and adds the first MCP server-level test. No structured output; no Claude Code CLI behavior change; version unchanged.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

# Phase 4 — PR 4: Skill & plugin metadata polish

Branch: `git checkout main && git checkout -b skill-metadata-polish`

### Task 4.1: Confirm which frontmatter keys + CLI commands actually exist

- [ ] **Step 1: Probe the installed CLI**

Run: `claude plugin --help` (note whether a `validate` subcommand exists).
Check the installed docs/version for whether `when_to_use` and `argument-hint` are recognized SKILL.md keys (`claude --version`; consult current skill docs). Record which of the three are confirmed.

### Task 4.2: Update skill frontmatter

**Files:**
- Modify: `skills/review/SKILL.md`, `skills/workshop/SKILL.md`

- [ ] **Step 1: Convert `allowed-tools` to a YAML list and add confirmed keys**

For `skills/review/SKILL.md`, replace the single-line `allowed-tools:` string with a YAML list of the **same** tool IDs, and add (only the keys confirmed in 4.1):

```yaml
argument-hint: "<document or file> — what to review for"
when_to_use: "Reviewing a document or draft, giving feedback, or checking a contract/proposal/spec for issues."
allowed-tools:
  - mcp__plugin_ezra_ezra__ezra_list
  - mcp__plugin_ezra_ezra__ezra_open
  - mcp__plugin_ezra_ezra__ezra_read
  - mcp__plugin_ezra_ezra__ezra_edit
  - mcp__plugin_ezra_ezra__ezra_write
  - mcp__plugin_ezra_ezra__ezra_suggest
  - mcp__plugin_ezra_ezra__ezra_comment
  - mcp__plugin_ezra_ezra__ezra_reply
  - mcp__plugin_ezra_ezra__ezra_resolve
  - mcp__plugin_ezra_ezra__ezra_accept
  - mcp__plugin_ezra_ezra__ezra_reject
  - mcp__plugin_ezra_ezra__ezra_create
  - mcp__plugin_ezra_ezra__ezra_threads
  - mcp__plugin_ezra_ezra__ezra_changes_since
  - mcp__plugin_ezra_ezra__ezra_import
  - mcp__plugin_ezra_ezra__ezra_duplicate
  - Glob
  - Grep
  - Read
```

For `skills/workshop/SKILL.md`, the same list with:

```yaml
argument-hint: "<document or file> to open for collaborative editing"
when_to_use: "Opening a document for the user to edit collaboratively, then acting on their tracked changes and comments."
```

- [ ] **Step 2: Verify skills still parse**

Run (if available from 4.1): `claude plugin validate .`
Else: confirm both files still have valid YAML frontmatter (no tabs; list items aligned) and the body is unchanged.

- [ ] **Step 3: Commit**

```bash
git add skills/review/SKILL.md skills/workshop/SKILL.md
git commit -m "docs(skills): add when_to_use/argument-hint, YAML-ify allowed-tools

Same tool IDs, more readable. Body unchanged.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4.3: Update CLAUDE.md and README

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: CLAUDE.md (only if `claude plugin validate` exists per 4.1)**

Add to the Testing section:

```markdown
- Plugin validation: `claude plugin validate .` (checks plugin.json, skill frontmatter, components)
```

- [ ] **Step 2: README drift**

If any tool description text changed in PR 3, update the matching row in the README MCP-tools table so it stays accurate. (If nothing changed, skip.)

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: note plugin validate in workflow; sync README tool table

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4.4: PR 4 verification + open PR

- [ ] **Step 1: Verify**

Run: `npm test && npm run build` (no functional code changed; run per CLAUDE.md). If available: `claude plugin validate .`.

- [ ] **Step 2: Open PR**

```bash
git push -u origin skill-metadata-polish
gh pr create --title "Polish skill & plugin metadata" --body "Adds when_to_use/argument-hint to both skills, converts allowed-tools to YAML lists (same IDs), documents plugin validation, syncs README. No version bump.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** every spec item maps to a task — server deps (1.2–1.7), express fix + coverage gap (1.1, 1.3), client deps (2.1–2.3), registerTool + annotations + new harness (3.1–3.2), zod-4 default check (1.2 + honored in 3.2), better-sqlite3 clean-spawn (1.4/1.8), TS6 tsconfig (1.6/2.3), metadata (4.1–4.3), README/CLAUDE.md (4.3). No structured output (out of scope). Version never bumped.
- **Verification tiers:** server PR gates on tests+build+clean `npm ci`; client PR additionally on app-launch + e2e.
- **If a major bump's `@latest` is itself a new major beyond the spec's target**, pin to the spec's target major and note it — don't silently jump further.
