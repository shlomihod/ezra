import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./mcp.js";

// MCP over stdio (for Claude Code plugin)
const mcpServer = createMcpServer();
const transport = new StdioServerTransport();
await mcpServer.connect(transport);
