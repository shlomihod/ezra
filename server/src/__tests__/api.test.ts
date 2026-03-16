import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  createDocument,
  getDocument,
  listDocuments,
  getThreadsForDoc,
  updateDocumentContent,
  getThread,
  createThread,
  createReply,
  resolveThread,
} from "../db.js";

// Replicate the validation schemas from index.ts
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

// Build a test-only Express app with the same routes (without starting a server)
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/documents", (_req, res) => {
  res.json(listDocuments());
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
  res.json({ success: true });
});

app.post("/api/threads", (req, res) => {
  const parsed = CreateThreadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { doc_id, anchor_text, author, body } = parsed.data;
  const doc = getDocument(doc_id);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const threadId = nanoid(10);
  const replyId = nanoid(10);
  createThread(threadId, doc_id, anchor_text);
  createReply(replyId, threadId, author || "You", body);
  res.json({ thread_id: threadId });
});

app.post("/api/threads/:id/replies", (req, res) => {
  const thread = getThread(req.params.id);
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  const parsed = CreateReplySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { author, body } = parsed.data;
  const replyId = nanoid(10);
  createReply(replyId, req.params.id, author || "You", body);
  res.json({ reply_id: replyId });
});

app.post("/api/threads/:id/resolve", (req, res) => {
  const thread = getThread(req.params.id);
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  resolveThread(req.params.id);
  res.json({ success: true });
});

const DOC_ID = "test-doc-api";

beforeAll(() => {
  if (!getDocument(DOC_ID)) {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Test document content" }],
        },
      ],
    });
    createDocument(DOC_ID, "Test Document", content);
  }
});

describe("GET /api/documents", () => {
  it("returns a list of documents", async () => {
    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /api/documents/:id", () => {
  it("returns a document by id", async () => {
    const res = await request(app).get(`/api/documents/${DOC_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(DOC_ID);
    expect(res.body.content).toBeDefined();
    expect(res.body.content.type).toBe("doc");
  });

  it("returns 404 for missing document", async () => {
    const res = await request(app).get("/api/documents/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/documents/:id/threads", () => {
  it("returns threads for a document", async () => {
    const res = await request(app).get(`/api/documents/${DOC_ID}/threads`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns threads with replies included", async () => {
    // Create a thread with a reply first
    const threadId = nanoid(10);
    const replyId = nanoid(10);
    createThread(threadId, DOC_ID, "content");
    createReply(replyId, threadId, "Author", "Reply body");

    const res = await request(app).get(`/api/documents/${DOC_ID}/threads`);
    expect(res.status).toBe(200);
    const thread = res.body.find((t: any) => t.id === threadId);
    expect(thread).toBeDefined();
    expect(thread.replies).toHaveLength(1);
    expect(thread.replies[0].body).toBe("Reply body");
  });

  it("returns 404 for missing document", async () => {
    const res = await request(app).get("/api/documents/nonexistent/threads");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/threads", () => {
  it("creates a thread and returns thread_id", async () => {
    const res = await request(app)
      .post("/api/threads")
      .send({
        doc_id: DOC_ID,
        anchor_text: "Test",
        author: "Tester",
        body: "A comment",
      });
    expect(res.status).toBe(200);
    expect(res.body.thread_id).toBeDefined();
  });

  it("returns 404 for missing document", async () => {
    const res = await request(app)
      .post("/api/threads")
      .send({
        doc_id: "nonexistent",
        anchor_text: "x",
        author: "a",
        body: "b",
      });
    expect(res.status).toBe(404);
  });

  it("returns 400 when body is missing", async () => {
    const res = await request(app)
      .post("/api/threads")
      .send({ doc_id: DOC_ID, anchor_text: "Test" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when anchor_text is empty", async () => {
    const res = await request(app)
      .post("/api/threads")
      .send({ doc_id: DOC_ID, anchor_text: "", body: "comment" });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/documents/:id/content", () => {
  it("updates document content", async () => {
    const content = {
      type: "doc" as const,
      content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }],
    };
    const res = await request(app)
      .put(`/api/documents/${DOC_ID}/content`)
      .send({ content });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 400 for invalid content", async () => {
    const res = await request(app)
      .put(`/api/documents/${DOC_ID}/content`)
      .send({ content: "not an object" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    const res = await request(app)
      .put(`/api/documents/${DOC_ID}/content`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing document", async () => {
    const res = await request(app)
      .put("/api/documents/nonexistent/content")
      .send({ content: { type: "doc", content: [] } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/threads/:id/replies", () => {
  let threadId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/threads")
      .send({ doc_id: DOC_ID, anchor_text: "Test", body: "starter" });
    threadId = res.body.thread_id;
  });

  it("creates a reply", async () => {
    const res = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .send({ author: "Tester", body: "A reply" });
    expect(res.status).toBe(200);
    expect(res.body.reply_id).toBeDefined();
  });

  it("returns 400 when body is missing", async () => {
    const res = await request(app)
      .post(`/api/threads/${threadId}/replies`)
      .send({ author: "Tester" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing thread", async () => {
    const res = await request(app)
      .post("/api/threads/nonexistent/replies")
      .send({ body: "reply" });
    expect(res.status).toBe(404);
  });
});
