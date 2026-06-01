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
