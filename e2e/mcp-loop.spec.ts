import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Full agent-native loop: a real MCP client drives the tools over the HTTP
// /mcp transport, and the already-open browser editor must reflect the change
// live (via the WebSocket push) — no page reload. This exercises the MCP
// server, persistence, the WebSocket broadcast, and the React/TipTap editor
// together.
//
// The MCP endpoint lives on the server origin (the vite dev server does not
// proxy /mcp), so target the server port directly regardless of the browser
// baseURL. Works both in CI (server serves everything on :3333) and in dev
// (server on :3333, browser on the vite port via the playwright baseURL).
const BASE = `http://localhost:${process.env.PORT || "3333"}`;

async function mcpClient() {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`));
  const client = new Client({ name: "e2e-mcp-loop", version: "0.0.0" });
  await client.connect(transport);
  return client;
}

function result(res: { content: { type: string; text: string }[] }) {
  return JSON.parse(res.content[0].text);
}

test("MCP server is reachable and lists all 16 tools with annotations", async () => {
  const client = await mcpClient();
  const { tools } = await client.listTools();
  const ezra = tools.filter((t) => t.name.startsWith("ezra_"));
  expect(ezra).toHaveLength(16);
  // annotations survive the real HTTP transport
  const read = ezra.find((t) => t.name === "ezra_read");
  expect(read?.annotations?.readOnlyHint).toBe(true);
  expect(read?.annotations?.openWorldHint).toBe(false);
  await client.close();
});

test("an MCP ezra_suggest call appears live in the open browser editor", async ({ page }) => {
  const client = await mcpClient();

  // 1. Create a document with known content via MCP.
  const imported = result(
    await client.callTool({
      name: "ezra_import",
      arguments: { title: "MCP Loop Test", content: "The quick brown fox.", format: "text" },
    }),
  );
  const docId = imported.doc_id as string;
  expect(docId).toBeTruthy();

  // 2. Open it in the browser and confirm the original text renders.
  await page.goto(`/#/${docId}`);
  const editor = page.locator(".tiptap, .ProseMirror, [contenteditable]").first();
  await expect(editor).toBeVisible({ timeout: 10000 });
  await expect(editor).toContainText("quick brown fox", { timeout: 10000 });

  // 3. Propose a tracked change via MCP — the browser is already open and must
  //    update live, with no reload.
  const suggested = result(
    await client.callTool({
      name: "ezra_suggest",
      arguments: { doc_id: docId, old_string: "quick", new_string: "swift" },
    }),
  );
  expect(suggested.success).toBe(true);

  // 4. The suggested insertion must appear live in the editor (Insertion mark
  //    renders as <ins class="tracked-insertion">).
  await expect(page.locator("ins.tracked-insertion")).toContainText("swift", { timeout: 10000 });

  await client.close();
});
