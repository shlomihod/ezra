import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { nanoid } from "nanoid";
import {
  createDocument,
  getDocument,
  createThread,
  createReply,
  resolveThread,
  logOperation,
  getOperationsSince,
} from "../db.js";
import { ezraThreads } from "../tools/threads.js";
import { ezraChangesSince } from "../tools/changes.js";
import { ezraWrite } from "../tools/write.js";
import { ezraEdit } from "../tools/edit.js";
import { ezraSuggest } from "../tools/suggest.js";
import { ezraComment } from "../tools/comment.js";
import { ezraImport } from "../tools/import.js";
import { ezraRead } from "../tools/read.js";
import { ezraDuplicate } from "../tools/duplicate.js";
import { extractPlainText } from "../prosemirror/helpers.js";

vi.mock("open", () => ({ default: vi.fn() }));
vi.mock("../app.js", () => ({
  createApp: () => ({ server: { listen: vi.fn((_port: number, cb?: () => void) => cb?.()) } }),
}));

const DOC_ID = "test-doc-tools-" + nanoid(6);

beforeAll(() => {
  if (!getDocument(DOC_ID)) {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Test document for tools" }],
        },
      ],
    });
    createDocument(DOC_ID, "Tools Test Doc", content);
  }
});

describe("ezra_open", () => {
  let ezraOpen: typeof import("../tools/open.js").ezraOpen;
  let mockOpen: ReturnType<typeof vi.fn>;
  let ws: typeof import("../ws.js");

  beforeAll(async () => {
    ws = await import("../ws.js");
    const openModule = await import("../tools/open.js");
    ezraOpen = openModule.ezraOpen;
    mockOpen = (await import("open")).default as ReturnType<typeof vi.fn>;
  });

  beforeEach(() => {
    mockOpen.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws for missing document", async () => {
    await expect(ezraOpen("nonexistent")).rejects.toThrow("Document not found");
  });

  it("returns doc_id and title", async () => {
    vi.spyOn(ws, "hasConnectedClients").mockReturnValue(false);
    const result = await ezraOpen(DOC_ID);
    expect(result).toEqual({ doc_id: DOC_ID, title: "Tools Test Doc" });
  });

  it("opens browser when no clients connected", async () => {
    vi.spyOn(ws, "hasConnectedClients").mockReturnValue(false);
    await ezraOpen(DOC_ID);
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining(`/#/${DOC_ID}`));
  });

  it("broadcasts via WebSocket when clients are connected", async () => {
    vi.spyOn(ws, "hasConnectedClients").mockReturnValue(true);
    const broadcastSpy = vi.spyOn(ws, "broadcast");
    await ezraOpen(DOC_ID);
    expect(mockOpen).not.toHaveBeenCalled();
    expect(broadcastSpy).toHaveBeenCalledWith("open_doc", { doc_id: DOC_ID });
  });
});

describe("ezra_threads", () => {
  let threadId1: string;
  let threadId2: string;

  beforeAll(() => {
    threadId1 = "thr-" + nanoid(6);
    threadId2 = "thr-" + nanoid(6);
    createThread(threadId1, DOC_ID, "Test");
    createReply(nanoid(10), threadId1, "Author", "First comment");
    createThread(threadId2, DOC_ID, "document");
    createReply(nanoid(10), threadId2, "Author", "Second comment");
    resolveThread(threadId2);
  });

  it("returns all threads for a doc", () => {
    const result = ezraThreads(DOC_ID);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by open status", () => {
    const result = ezraThreads(DOC_ID, "open");
    expect(result.every((t) => t.status === "open")).toBe(true);
  });

  it("filters by resolved status", () => {
    const result = ezraThreads(DOC_ID, "resolved");
    expect(result.every((t) => t.status === "resolved")).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("returns all when status is 'all'", () => {
    const result = ezraThreads(DOC_ID, "all");
    const statuses = new Set(result.map((t) => t.status));
    expect(statuses.size).toBeGreaterThanOrEqual(1);
  });

  it("includes replies in threads", () => {
    const result = ezraThreads(DOC_ID);
    const thread = result.find((t) => t.id === threadId1);
    expect(thread).toBeDefined();
    expect(thread!.replies.length).toBeGreaterThanOrEqual(1);
  });

  it("throws for missing document", () => {
    expect(() => ezraThreads("nonexistent")).toThrow("Document not found");
  });
});

describe("ezra_changes_since", () => {
  it("returns operations after cursor 0", () => {
    logOperation("test_op", DOC_ID, JSON.stringify({ test: true }));
    const result = ezraChangesSince(0);
    expect(result.operations.length).toBeGreaterThanOrEqual(1);
    expect(result.next_cursor).toBeGreaterThan(0);
  });

  it("returns empty when cursor is at latest", () => {
    const first = ezraChangesSince(0);
    const result = ezraChangesSince(first.next_cursor);
    expect(result.operations).toHaveLength(0);
    expect(result.next_cursor).toBe(first.next_cursor);
  });

  it("returns only new operations after cursor", () => {
    const before = ezraChangesSince(0);
    logOperation("new_op", DOC_ID, null);
    const after = ezraChangesSince(before.next_cursor);
    expect(after.operations.length).toBe(1);
    expect(after.operations[0].type).toBe("new_op");
  });

  it("operations have expected fields", () => {
    const result = ezraChangesSince(0);
    const op = result.operations[0];
    expect(op).toHaveProperty("id");
    expect(op).toHaveProperty("type");
    expect(op).toHaveProperty("created_at");
  });
});

describe("ezra_write", () => {
  const WRITE_DOC_ID = "test-write-" + nanoid(6);

  beforeAll(() => {
    const content = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    createDocument(WRITE_DOC_ID, "Write Test Doc", content);
  });

  it("writes plain text to existing doc", () => {
    const result = ezraWrite(WRITE_DOC_ID, "Hello world");
    expect(result).toEqual({ success: true, doc_id: WRITE_DOC_ID });

    const doc = getDocument(WRITE_DOC_ID);
    const parsed = JSON.parse(doc!.content);
    expect(parsed.type).toBe("doc");
    expect(parsed.content).toHaveLength(1);
    expect(parsed.content[0].type).toBe("paragraph");
    expect(parsed.content[0].content[0].text).toBe("Hello world");
  });

  it("throws for missing doc", () => {
    expect(() => ezraWrite("nonexistent", "text")).toThrow("Document not found");
  });

  it("parses markdown headings", () => {
    ezraWrite(WRITE_DOC_ID, "# My Title\n\nSome text");
    const doc = getDocument(WRITE_DOC_ID);
    const parsed = JSON.parse(doc!.content);
    expect(parsed.content[0].type).toBe("heading");
    expect(parsed.content[0].attrs.level).toBe(1);
    expect(parsed.content[0].content[0].text).toBe("My Title");
    expect(parsed.content[1].type).toBe("paragraph");
  });

  it("parses markdown bold and italic", () => {
    ezraWrite(WRITE_DOC_ID, "A **bold** and *italic* paragraph");
    const doc = getDocument(WRITE_DOC_ID);
    const parsed = JSON.parse(doc!.content);
    const content = parsed.content[0].content;
    const boldNode = content.find((n: any) => n.marks?.some((m: any) => m.type === "bold"));
    expect(boldNode).toBeDefined();
    expect(boldNode.text).toBe("bold");
    const italicNode = content.find((n: any) => n.marks?.some((m: any) => m.type === "italic"));
    expect(italicNode).toBeDefined();
    expect(italicNode.text).toBe("italic");
  });

  it("parses markdown links", () => {
    ezraWrite(WRITE_DOC_ID, "Click [here](https://example.com) for more");
    const doc = getDocument(WRITE_DOC_ID);
    const parsed = JSON.parse(doc!.content);
    const content = parsed.content[0].content;
    const linkNode = content.find((n: any) => n.marks?.some((m: any) => m.type === "link"));
    expect(linkNode).toBeDefined();
    expect(linkNode.text).toBe("here");
    const linkMark = linkNode.marks.find((m: any) => m.type === "link");
    expect(linkMark.attrs.href).toBe("https://example.com");
  });
});

describe("logOperation", () => {
  it("logs operations with all fields", () => {
    const before = ezraChangesSince(0);
    logOperation("edit", DOC_ID, JSON.stringify({ old: "a", new: "b" }));
    const after = ezraChangesSince(before.next_cursor);
    expect(after.operations).toHaveLength(1);
    expect(after.operations[0].type).toBe("edit");
    expect(after.operations[0].doc_id).toBe(DOC_ID);
    expect(after.operations[0].details).not.toBeNull();
  });

  it("handles null doc_id and details", () => {
    const before = ezraChangesSince(0);
    logOperation("test", null, null);
    const after = ezraChangesSince(before.next_cursor);
    expect(after.operations).toHaveLength(1);
    expect(after.operations[0].doc_id).toBeNull();
    expect(after.operations[0].details).toBeNull();
  });
});

describe("ezra_edit with old_end", () => {
  const EDIT_DOC_ID = "test-edit-span-" + nanoid(6);

  beforeAll(() => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "The quick brown fox jumps over the lazy dog" }] },
      ],
    });
    createDocument(EDIT_DOC_ID, "Edit Span Test", content);
  });

  it("resolves span with old_end and replaces it", () => {
    const result = ezraEdit(EDIT_DOC_ID, "quick brown", "fast red cat", "lazy dog");
    expect(result.success).toBe(true);
    const doc = getDocument(EDIT_DOC_ID);
    const text = extractPlainText(JSON.parse(doc!.content));
    expect(text).toBe("The fast red cat");
  });
});

describe("ezra_suggest with old_end", () => {
  const SUGGEST_DOC_ID = "test-suggest-span-" + nanoid(6);

  beforeAll(() => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "The quick brown fox jumps over the lazy dog" }] },
      ],
    });
    createDocument(SUGGEST_DOC_ID, "Suggest Span Test", content);
  });

  it("resolves span with old_end and creates tracked changes", () => {
    const result = ezraSuggest(SUGGEST_DOC_ID, "quick brown", "fast red cat", "lazy dog");
    expect(result.success).toBe(true);
    const doc = getDocument(SUGGEST_DOC_ID);
    const content = JSON.parse(doc!.content);
    // Tracked changes should be visible as insertion/deletion marks in the content
    const hasTrackedMarks = content.content.some((block: { content?: { marks?: { type: string }[] }[] }) =>
      block.content?.some((node: { marks?: { type: string }[] }) =>
        node.marks?.some((m: { type: string }) => m.type === "insertion" || m.type === "deletion")
      )
    );
    expect(hasTrackedMarks).toBe(true);
  });
});

describe("ezra_comment with anchor_end", () => {
  const COMMENT_DOC_ID = "test-comment-span-" + nanoid(6);

  beforeAll(() => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "The quick brown fox jumps over the lazy dog" }] },
      ],
    });
    createDocument(COMMENT_DOC_ID, "Comment Span Test", content);
  });

  it("resolves anchor span with anchor_end", () => {
    const result = ezraComment(COMMENT_DOC_ID, "quick brown", "Test comment", "Claude", "lazy dog");
    expect(result.thread_id).toBeDefined();
    expect(result.doc_id).toBe(COMMENT_DOC_ID);
  });
});

describe("ezra_read", () => {
  const READ_DOC_ID = "test-read-" + nanoid(6);

  beforeAll(() => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "My Title" }] },
        { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
      ],
    });
    createDocument(READ_DOC_ID, "Read Test Doc", content);
  });

  it("returns markdown output with headings", () => {
    const result = ezraRead(READ_DOC_ID);
    expect(result).toContain("# My Title");
    expect(result).toContain("Hello world");
    // Should NOT contain line number prefixes
    expect(result).not.toMatch(/^\s*\d+\s*\|/m);
    // Should NOT contain a title prefix
    expect(result).not.toContain("# Read Test Doc");
  });

  it("includes tracked changes in markdown output", () => {
    const TRACKED_DOC_ID = "test-read-tracked-" + nanoid(6);
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "new", marks: [{ type: "insertion" }] },
            { type: "text", text: " world" },
          ],
        },
      ],
    });
    createDocument(TRACKED_DOC_ID, "Tracked Read", content);
    const result = ezraRead(TRACKED_DOC_ID);
    expect(result).toContain("[+new+]");
  });

  it("includes bold and italic in markdown output", () => {
    const RICH_DOC_ID = "test-read-rich-" + nanoid(6);
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This is " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " text" },
          ],
        },
      ],
    });
    createDocument(RICH_DOC_ID, "Rich Read", content);
    const result = ezraRead(RICH_DOC_ID);
    expect(result).toContain("**bold**");
  });

  it("throws for missing document", () => {
    expect(() => ezraRead("nonexistent")).toThrow("Document not found");
  });
});

describe("ezra_duplicate", () => {
  const DUP_DOC_ID = "test-dup-" + nanoid(6);
  const DUP_CONTENT = JSON.stringify({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Original" }] },
      { type: "paragraph", content: [{ type: "text", text: "Some content" }] },
    ],
  });

  beforeAll(() => {
    createDocument(DUP_DOC_ID, "Original Doc", DUP_CONTENT);
  });

  it("creates a new document with the same content", () => {
    const result = ezraDuplicate(DUP_DOC_ID);
    expect(result.doc_id).toBeDefined();
    expect(result.doc_id).not.toBe(DUP_DOC_ID);
    expect(result.source_doc_id).toBe(DUP_DOC_ID);

    const newDoc = getDocument(result.doc_id);
    expect(newDoc).not.toBeNull();
    expect(newDoc!.content).toBe(DUP_CONTENT);
  });

  it("uses original title by default", () => {
    const result = ezraDuplicate(DUP_DOC_ID);
    expect(result.title).toBe("Original Doc");
    const newDoc = getDocument(result.doc_id);
    expect(newDoc!.title).toBe("Original Doc");
  });

  it("accepts a custom title", () => {
    const result = ezraDuplicate(DUP_DOC_ID, "Original Doc v2");
    expect(result.title).toBe("Original Doc v2");
    const newDoc = getDocument(result.doc_id);
    expect(newDoc!.title).toBe("Original Doc v2");
  });

  it("throws for missing document", () => {
    expect(() => ezraDuplicate("nonexistent")).toThrow("Document not found");
  });
});

describe("ezra_import", () => {
  it("creates doc with plain text content", () => {
    const result = ezraImport("Import Test Doc", "Line one\nLine two\nLine three", "text");
    expect(result.doc_id).toBeDefined();
    expect(result.title).toBe("Import Test Doc");

    const doc = getDocument(result.doc_id);
    expect(doc).not.toBeNull();
    const text = extractPlainText(JSON.parse(doc!.content));
    expect(text).toBe("Line one\nLine two\nLine three");
  });

  it("creates doc with markdown content by default", () => {
    const result = ezraImport("Markdown Import", "# Hello\n\nA **bold** paragraph");
    expect(result.doc_id).toBeDefined();

    const doc = getDocument(result.doc_id);
    expect(doc).not.toBeNull();
    const parsed = JSON.parse(doc!.content);
    // Should have a heading node
    expect(parsed.content[0].type).toBe("heading");
    expect(parsed.content[0].attrs.level).toBe(1);
    // Should have a paragraph with bold mark
    const paragraph = parsed.content[1];
    expect(paragraph.type).toBe("paragraph");
    const boldNode = paragraph.content.find((n: any) => n.marks?.some((m: any) => m.type === "bold"));
    expect(boldNode).toBeDefined();
    expect(boldNode.text).toBe("bold");
  });

  it("creates doc with empty content", () => {
    const result = ezraImport("Empty Import", "");
    expect(result.doc_id).toBeDefined();
    const doc = getDocument(result.doc_id);
    expect(doc).not.toBeNull();
  });
});
