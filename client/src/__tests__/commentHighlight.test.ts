import { describe, it, expect } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Node } from "@tiptap/pm/model";
import {
  findTextPositions,
  type CommentThread,
} from "../extensions/commentHighlight";

const schema = getSchema([StarterKit]);

function makeDoc(
  ...blocks: (string | { type: "heading"; text: string })[]
): Node {
  return Node.fromJSON(schema, {
    type: "doc",
    content: blocks.map((b) =>
      typeof b === "string"
        ? {
            type: "paragraph",
            content: b ? [{ type: "text", text: b }] : undefined,
          }
        : {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: b.text }],
          }
    ),
  });
}

describe("findTextPositions", () => {
  it("finds text in a single block", () => {
    const doc = makeDoc("Hello world");
    const results = findTextPositions(doc, "world");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ from: 7, to: 12 });
  });

  it("finds multiple occurrences in one block", () => {
    const doc = makeDoc("foo bar foo");
    const results = findTextPositions(doc, "foo");
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ from: 1, to: 4 });
    expect(results[1]).toEqual({ from: 9, to: 12 });
  });

  it("finds same text in different blocks", () => {
    const doc = makeDoc("First block", "Second block");
    const results = findTextPositions(doc, "block");
    expect(results).toHaveLength(2);
  });

  it("returns empty array when text is not found", () => {
    const doc = makeDoc("Hello world");
    const results = findTextPositions(doc, "missing");
    expect(results).toEqual([]);
  });

  it("matches across two paragraphs with space separator", () => {
    const doc = makeDoc("Heading", "Para");
    const results = findTextPositions(doc, "Heading Para");
    expect(results).toHaveLength(1);
  });

  it("matches across blocks when anchor has newline separator", () => {
    const doc = makeDoc("A", "B");
    const results = findTextPositions(doc, "A\nB");
    expect(results).toHaveLength(1);
  });

  it("matches across heading and paragraph", () => {
    const doc = makeDoc({ type: "heading", text: "Title" }, "Body");
    const results = findTextPositions(doc, "Title Body");
    expect(results).toHaveLength(1);
  });

  it("matches partial cross-block text", () => {
    const doc = makeDoc("Hello world", "Good morning");
    const results = findTextPositions(doc, "world Good");
    expect(results).toHaveLength(1);
  });

  it("returns empty array for empty search", () => {
    const doc = makeDoc("Hello");
    expect(findTextPositions(doc, "")).toEqual([]);
  });

  it("returns empty array for whitespace-only search", () => {
    const doc = makeDoc("Hello");
    expect(findTextPositions(doc, "   \n\t  ")).toEqual([]);
  });

  it("normalizes multiple spaces in search text", () => {
    const doc = makeDoc("foo bar");
    const results = findTextPositions(doc, "foo  bar");
    expect(results).toHaveLength(1);
  });

  it("returns correct positions for a known doc structure", () => {
    // doc: <p>ab</p><p>cd</p>
    // PM positions: 0=p1_start, 1='a', 2='b', 3=p1_end, 4=p2_start, 5='c', 6='d', 7=p2_end
    // flat string: "ab cd" with posMap [1, 2, -1, 5, 6]
    // Searching "ab cd": from=posMap[0]=1, to=posMap[4]+1=6+1=7
    const doc = makeDoc("ab", "cd");
    const results = findTextPositions(doc, "ab cd");
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ from: 1, to: 7 });
  });
});

/**
 * Replicate the thread-filtering logic from buildDecorations to test
 * that resolved/rejected threads are skipped.
 */
function filterThreadsForHighlight(threads: CommentThread[]): CommentThread[] {
  return threads.filter((t) => t.status === "open" && !!t.anchor_text);
}

describe("thread filtering for highlights", () => {
  it("includes open threads with anchor text", () => {
    const threads: CommentThread[] = [
      { id: "1", anchor_text: "hello", status: "open" },
    ];
    expect(filterThreadsForHighlight(threads)).toHaveLength(1);
  });

  it("excludes resolved threads", () => {
    const threads: CommentThread[] = [
      { id: "1", anchor_text: "hello", status: "resolved" },
    ];
    expect(filterThreadsForHighlight(threads)).toHaveLength(0);
  });

  it("excludes rejected threads", () => {
    const threads: CommentThread[] = [
      { id: "1", anchor_text: "hello", status: "rejected" },
    ];
    expect(filterThreadsForHighlight(threads)).toHaveLength(0);
  });

  it("excludes threads without anchor text", () => {
    const threads: CommentThread[] = [
      { id: "1", anchor_text: "", status: "open" },
    ];
    expect(filterThreadsForHighlight(threads)).toHaveLength(0);
  });

  it("filters mixed thread statuses correctly", () => {
    const threads: CommentThread[] = [
      { id: "1", anchor_text: "a", status: "open" },
      { id: "2", anchor_text: "b", status: "resolved" },
      { id: "3", anchor_text: "c", status: "open" },
    ];
    const result = filterThreadsForHighlight(threads);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["1", "3"]);
  });
});
