import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { Express, Request, Response } from "express";

import { ezraList } from "./tools/list.js";
import { ezraOpen } from "./tools/open.js";
import { ezraRead } from "./tools/read.js";
import { ezraEdit } from "./tools/edit.js";
import { ezraWrite } from "./tools/write.js";
import { ezraSuggest } from "./tools/suggest.js";
import { ezraComment } from "./tools/comment.js";
import { ezraReply } from "./tools/reply.js";
import { ezraResolve } from "./tools/resolve.js";
import { ezraAccept } from "./tools/accept.js";
import { ezraReject } from "./tools/reject.js";
import { ezraCreate } from "./tools/create.js";
import { ezraThreads } from "./tools/threads.js";
import { ezraChangesSince } from "./tools/changes.js";
import { ezraImport } from "./tools/import.js";
import { ezraDuplicate } from "./tools/duplicate.js";

function errorResult(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true as const };
}

type ToolResult = { content: { type: "text"; text: string }[] } | { content: { type: "text"; text: string }[]; isError: true };

function toolHandler(fn: (args: any) => any, pretty = false): (args: any) => Promise<ToolResult> {
  return async (args) => {
    try {
      const result = await fn(args);
      return { content: [{ type: "text" as const, text: pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result) }] };
    } catch (e) {
      return errorResult(e);
    }
  };
}

function textHandler(fn: (args: any) => any): (args: any) => Promise<ToolResult> {
  return async (args) => {
    try {
      const result = await fn(args);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e) {
      return errorResult(e);
    }
  };
}

export function createMcpServer() {
  const server = new McpServer({
    name: "Ezra",
    version: "0.1.0",
  });

  server.registerTool("ezra_list", {
    description: "List all documents. Returns titles, IDs, and whether each is currently open in the browser.",
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, toolHandler(() => ezraList(), true));

  server.registerTool("ezra_open", {
    description: "Open a document in the browser.",
    inputSchema: { doc_id: z.string().describe("The document ID to open") },
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, toolHandler(({ doc_id }) => ezraOpen(doc_id)));

  server.registerTool("ezra_read", {
    description: "Read a document's content as markdown, plus any open comment threads and tracked changes. Tracked insertions appear as [+text+] and deletions as [-text-].",
    inputSchema: {
      doc_id: z.string().describe("The document ID to read"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, textHandler(({ doc_id }) => ezraRead(doc_id)));

  server.registerTool("ezra_edit", {
    description: "Replace text in a document immediately (not reviewable — use ezra_suggest for tracked changes). old_string must match plain text only — do not include markdown syntax (##, **, *) or tracked change markers ([+text+] / [-text-]) from ezra_read. Must be unique in the document. When old_end is provided, replaces the full span from old_string to old_end (must be in the same paragraph).",
    inputSchema: {
      doc_id: z.string().describe("The document ID to edit"),
      old_string: z.string().describe("The exact text to find and replace, or the start of a span when old_end is provided (must be unique)"),
      new_string: z.string().describe("The replacement text"),
      old_end: z.string().optional().describe("End of the text span. When provided, old_string marks the start and old_end marks the end — the full text between them is resolved and replaced."),
    },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ doc_id, old_string, new_string, old_end }) => ezraEdit(doc_id, old_string, new_string, old_end)));

  server.registerTool("ezra_write", {
    description: "Overwrite entire document content. Content is parsed as markdown. Use instead of ezra_edit when replacing all content or writing to an empty document.",
    inputSchema: {
      doc_id: z.string().describe("The document ID"),
      content: z.string().max(1_000_000).describe("The full document content as markdown. Replaces entire document."),
    },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ doc_id, content }) => ezraWrite(doc_id, content)));

  server.registerTool("ezra_suggest", {
    description: "Propose a tracked change (insertion/deletion) for the human to accept or reject. old_string must match plain text only — do not include markdown syntax (##, **, *) or tracked change markers ([+text+] / [-text-]) from ezra_read. Must be unique in the document. When old_end is provided, the span from old_string to old_end is used (must be in the same paragraph).",
    inputSchema: {
      doc_id: z.string().describe("The document ID"),
      old_string: z.string().describe("The exact text to find, or the start of a span when old_end is provided (must be unique)"),
      new_string: z.string().describe("The suggested replacement text"),
      old_end: z.string().optional().describe("End of the text span. When provided, old_string marks the start and old_end marks the end — the full text between them is resolved."),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ doc_id, old_string, new_string, old_end }) => ezraSuggest(doc_id, old_string, new_string, old_end)));

  server.registerTool("ezra_comment", {
    description: "Create a comment thread anchored to specific text. anchor_text must match plain text only — do not include markdown syntax (##, **, *). When anchor_end is provided, anchors the span from anchor_text to anchor_end.",
    inputSchema: {
      doc_id: z.string().describe("The document ID"),
      anchor_text: z.string().describe("The text to anchor the comment to, or the start of a span when anchor_end is provided (must exist in doc)"),
      body: z.string().describe("The comment body (plain text, not markdown)"),
      anchor_end: z.string().optional().describe("End of the anchor span. When provided, anchor_text marks the start and anchor_end marks the end — the full text between them is used as the anchor."),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ doc_id, anchor_text, body, anchor_end }) => ezraComment(doc_id, anchor_text, body, "Claude", anchor_end)));

  server.registerTool("ezra_reply", {
    description: "Reply to an existing comment thread.",
    inputSchema: {
      thread_id: z.string().describe("The thread ID to reply to"),
      body: z.string().describe("The reply body (plain text, not markdown)"),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ thread_id, body }) => ezraReply(thread_id, body)));

  server.registerTool("ezra_resolve", {
    description: "Resolve a comment thread, optionally with a closing note.",
    inputSchema: {
      thread_id: z.string().describe("The thread ID to resolve"),
      body: z.string().optional().describe("Optional closing note (plain text, not markdown)"),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ thread_id, body }) => ezraResolve(thread_id, body)));

  server.registerTool("ezra_accept", {
    description: "Accept a tracked change (insertion or deletion). Accepting an insertion keeps the text; accepting a deletion removes the text.",
    inputSchema: {
      doc_id: z.string().describe("The document ID"),
      text: z.string().describe("The exact text of the tracked change to accept"),
      mark_type: z.enum(["insertion", "deletion"]).optional().describe("Specify if multiple changes match the same text"),
    },
    annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, toolHandler(({ doc_id, text, mark_type }) => ezraAccept(doc_id, text, mark_type)));

  server.registerTool("ezra_reject", {
    description: "Reject a tracked change (insertion or deletion). Rejecting an insertion removes the text; rejecting a deletion keeps the text.",
    inputSchema: {
      doc_id: z.string().describe("The document ID"),
      text: z.string().describe("The exact text of the tracked change to reject"),
      mark_type: z.enum(["insertion", "deletion"]).optional().describe("Specify if multiple changes match the same text"),
    },
    annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  }, toolHandler(({ doc_id, text, mark_type }) => ezraReject(doc_id, text, mark_type)));

  server.registerTool("ezra_create", {
    description: "Create a new document. Returns the new document ID.",
    inputSchema: {
      title: z.string().min(1).max(200).describe("The document title"),
      content: z.string().max(1_000_000).optional().describe("Optional initial content as ProseMirror JSON string. Defaults to an empty document."),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ title, content }) => ezraCreate(title, content)));

  server.registerTool("ezra_threads", {
    description: "Query comment threads for a document. Returns threads with all replies.",
    inputSchema: {
      doc_id: z.string().describe("The document ID"),
      status: z.enum(["open", "resolved", "all"]).optional().describe("Filter by status (default: all)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, toolHandler(({ doc_id, status }) => ezraThreads(doc_id, status), true));

  server.registerTool("ezra_changes_since", {
    description: "Get all operations (edits, suggestions, comments, etc.) since a given cursor. Returns operations and a next_cursor for polling.",
    inputSchema: { cursor: z.number().default(0).describe("The operation ID cursor to fetch changes after (0 for all)") },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, toolHandler(({ cursor }) => ezraChangesSince(cursor), true));

  server.registerTool("ezra_duplicate", {
    description: "Duplicate a document. Useful for creating new versions (v2, v3, etc.).",
    inputSchema: {
      doc_id: z.string().describe("The document ID to duplicate"),
      title: z.string().min(1).max(200).optional().describe("Title for the new document (defaults to the original title)"),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ doc_id, title }) => ezraDuplicate(doc_id, title)));

  server.registerTool("ezra_import", {
    description: "Import content as a new document. Parses as markdown by default; use format: \"text\" for plain text.",
    inputSchema: {
      title: z.string().min(1).max(200).describe("The document title"),
      content: z.string().max(1_000_000).describe("The document content"),
      format: z.enum(["markdown", "text"]).default("markdown").describe("Content format"),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, toolHandler(({ title, content, format }) => ezraImport(title, content, format)));

  return server;
}

const MAX_SESSIONS = 10;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}

const sessions = new Map<string, SessionEntry>();

function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.lastActivity > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

export function mountMcp(app: Express) {
  // Periodic cleanup every 5 minutes. unref() so this timer never keeps the
  // process (or a test runner) alive on its own.
  setInterval(cleanupStaleSessions, 5 * 60 * 1000).unref();

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const entry = sessions.get(sessionId)!;
      entry.lastActivity = Date.now();
      await entry.transport.handleRequest(req, res, req.body);
      return;
    }

    // Cleanup before checking limit
    cleanupStaleSessions();

    if (sessions.size >= MAX_SESSIONS) {
      res.status(503).json({ error: "Too many active sessions" });
      return;
    }

    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, lastActivity: Date.now() });
      },
    });

    transport.onclose = () => {
      const id = [...sessions.entries()].find(([_, e]) => e.transport === transport)?.[0];
      if (id) sessions.delete(id);
    };

    // A McpServer instance binds to a single transport, so each session gets
    // its own server — reusing one across sessions throws "Already connected
    // to a transport" on the second session.
    const mcpServer = createMcpServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "No active session" });
      return;
    }
    const entry = sessions.get(sessionId)!;
    entry.lastActivity = Date.now();
    await entry.transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const entry = sessions.get(sessionId)!;
      await entry.transport.handleRequest(req, res);
      sessions.delete(sessionId);
    } else {
      res.status(400).json({ error: "No active session" });
    }
  });
}
