import { describe, it, expect } from "vitest";
import { extractPlainText, replaceText, resolveSpan } from "../prosemirror/helpers.js";
import type { DocJson } from "../prosemirror/helpers.js";

function makeDoc(...paragraphs: string[]): DocJson {
  return {
    type: "doc" as const,
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : undefined,
    })),
  };
}

describe("extractPlainText", () => {
  it("extracts text from paragraphs joined by newlines", () => {
    const doc = makeDoc("Hello world", "Second line");
    expect(extractPlainText(doc)).toBe("Hello world\nSecond line");
  });

  it("handles empty paragraphs", () => {
    const doc = makeDoc("First", "", "Third");
    expect(extractPlainText(doc)).toBe("First\n\nThird");
  });

  it("handles a single paragraph", () => {
    const doc = makeDoc("Only line");
    expect(extractPlainText(doc)).toBe("Only line");
  });
});

describe("resolveSpan", () => {
  it("resolves start-only", () => {
    const doc = makeDoc("Hello world");
    const result = resolveSpan(doc, "world");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("world");
    expect(result!.to - result!.from).toBe(5);
  });

  it("resolves start + end span", () => {
    const doc = makeDoc("The quick brown fox jumps over the lazy dog");
    const result = resolveSpan(doc, "quick brown", "lazy dog");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("quick brown fox jumps over the lazy dog");
  });

  it("returns null when start is not found", () => {
    const doc = makeDoc("Hello world");
    expect(resolveSpan(doc, "missing")).toBeNull();
  });

  it("throws when start is not unique", () => {
    const doc = makeDoc("foo bar foo");
    expect(() => resolveSpan(doc, "foo")).toThrow("not unique");
  });

  it("throws when end is not unique", () => {
    const doc = makeDoc("xyz def abc ghi abc");
    expect(() => resolveSpan(doc, "def", "abc")).toThrow("not unique");
  });

  it("throws when end is not found after start", () => {
    const doc = makeDoc("Hello world");
    expect(() => resolveSpan(doc, "Hello", "missing")).toThrow("not found");
  });
});

describe("replaceText", () => {
  it("replaces text and returns new doc JSON", () => {
    const doc = makeDoc("Hello world");
    const span = resolveSpan(doc, "world")!;
    const result = replaceText(doc, "vitest", span);
    expect(result.content[0].content![0].text).toBe("Hello vitest");
  });

  it("handles replacement with longer text", () => {
    const doc = makeDoc("ab");
    const span = resolveSpan(doc, "ab")!;
    const result = replaceText(doc, "abcdef", span);
    expect(result.content[0].content![0].text).toBe("abcdef");
  });

  it("handles replacement with shorter text", () => {
    const doc = makeDoc("Hello beautiful world");
    const span = resolveSpan(doc, "beautiful ")!;
    const result = replaceText(doc, "", span);
    expect(result.content[0].content![0].text).toBe("Hello world");
  });
});

