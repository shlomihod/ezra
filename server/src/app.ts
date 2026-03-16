import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

import "./db.js"; // initialize database
import { setupWebSocket } from "./ws.js";

import { listDocuments, getDocument, getThreadsForDoc, updateDocumentContent, clearAll } from "./db.js";
import { broadcast } from "./ws.js";
import { ezraComment } from "./tools/comment.js";
import { ezraReply } from "./tools/reply.js";
import { ezraResolve } from "./tools/resolve.js";
import { ezraCreate } from "./tools/create.js";

const UpdateContentSchema = z.object({
  content: z.object({
    type: z.literal("doc"),
    content: z.array(z.object({}).passthrough()),
  }).passthrough(),
});

const CreateThreadSchema = z.object({
  doc_id: z.string().min(1).max(100),
  anchor_text: z.string().min(1).max(10000),
  author: z.string().max(200).optional(),
  body: z.string().min(1).max(50000),
});

const CreateReplySchema = z.object({
  author: z.string().max(200).optional(),
  body: z.string().min(1).max(50000),
});

const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(200),
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { PORT } from "./config.js";

export function createApp(opts?: { beforeStaticFiles?: (app: express.Express) => void }) {

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: `http://localhost:${PORT}` }));
  app.use(express.json({ limit: "10mb" }));

  // API routes
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/documents", (_req, res) => {
    res.json(listDocuments());
  });

  app.post("/api/documents", (req, res) => {
    const parsed = CreateDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    try {
      const result = ezraCreate(parsed.data.title);
      res.json({ id: result.doc_id, title: result.title });
    } catch (e) {
      console.error("Failed to create document:", e);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  app.get("/api/documents/:id", (req, res) => {
    const doc = getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...doc, content: JSON.parse(doc.content) });
  });

  app.get("/api/documents/:id/threads", (req, res) => {
    const doc = getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(getThreadsForDoc(req.params.id));
  });

  app.put("/api/documents/:id/content", (req, res) => {
    const doc = getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = UpdateContentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { content } = parsed.data;
    updateDocumentContent(req.params.id, JSON.stringify(content));
    broadcast("doc_update", { doc_id: req.params.id, content }, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/threads", (req, res) => {
    const parsed = CreateThreadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { doc_id, anchor_text, author, body } = parsed.data;
    try {
      const result = ezraComment(doc_id, anchor_text, body, author || "You");
      res.json({ thread_id: result.thread_id });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isNotFound = message.includes("not found");
      const isNotUnique = message.includes("not unique");
      if (isNotFound) {
        res.status(404).json({ error: "Document or anchor text not found" });
      } else if (isNotUnique) {
        res.status(400).json({ error: "Text is not unique in the document. Select a more specific passage." });
      } else {
        console.error("Failed to create thread:", e);
        res.status(500).json({ error: "Failed to create comment" });
      }
    }
  });

  app.post("/api/threads/:id/replies", (req, res) => {
    const parsed = CreateReplySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { author, body } = parsed.data;
    try {
      const result = ezraReply(req.params.id, body, author || "You");
      res.json({ reply_id: result.reply_id });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("not found")) {
        res.status(404).json({ error: "Thread not found" });
      } else {
        console.error("Failed to create reply:", e);
        res.status(500).json({ error: "Failed to create reply" });
      }
    }
  });

  app.post("/api/threads/:id/resolve", (req, res) => {
    try {
      ezraResolve(req.params.id);
      res.json({ success: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("not found")) {
        res.status(404).json({ error: "Thread not found" });
      } else {
        console.error("Failed to resolve thread:", e);
        res.status(500).json({ error: "Failed to resolve thread" });
      }
    }
  });

  app.post("/api/clear", (_req, res) => {
    clearAll();
    broadcast("doc_list_update", {});
    res.json({ success: true });
  });

  // Hook for additional middleware (e.g. HTTP MCP) before static files
  opts?.beforeStaticFiles?.(app);

  // Serve client in production
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // Create HTTP server with WebSocket
  const server = createServer(app);
  setupWebSocket(server);

  return { app, server };
}
