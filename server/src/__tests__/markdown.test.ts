import { describe, it, expect } from "vitest";
import { markdownToDoc, docToMarkdown } from "../prosemirror/markdown.js";
import type { DocJson, NodeJson } from "../prosemirror/helpers.js";

/** Helper: extract all text from a doc recursively */
function allText(node: NodeJson): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(allText).join("");
}

/** Helper: find nodes of a given type */
function findNodes(doc: DocJson, type: string): NodeJson[] {
  const results: NodeJson[] = [];
  function walk(node: NodeJson) {
    if (node.type === type) results.push(node);
    for (const child of node.content ?? []) walk(child);
  }
  walk(doc);
  return results;
}

describe("markdownToDoc", () => {
  it("parses headings", () => {
    const doc = markdownToDoc("# Heading 1\n\n## Heading 2\n\n### Heading 3");
    const headings = findNodes(doc, "heading");
    expect(headings).toHaveLength(3);
    expect(headings[0].attrs?.level).toBe(1);
    expect(allText(headings[0])).toBe("Heading 1");
    expect(headings[1].attrs?.level).toBe(2);
    expect(headings[2].attrs?.level).toBe(3);
  });

  it("parses paragraphs", () => {
    const doc = markdownToDoc("First paragraph\n\nSecond paragraph");
    const paragraphs = findNodes(doc, "paragraph");
    expect(paragraphs).toHaveLength(2);
    expect(allText(paragraphs[0])).toBe("First paragraph");
    expect(allText(paragraphs[1])).toBe("Second paragraph");
  });

  it("parses bullet lists", () => {
    const doc = markdownToDoc("- Item one\n- Item two\n- Item three");
    const lists = findNodes(doc, "bulletList");
    expect(lists).toHaveLength(1);
    const items = findNodes(doc, "listItem");
    expect(items).toHaveLength(3);
    expect(allText(items[0])).toBe("Item one");
  });

  it("parses ordered lists", () => {
    const doc = markdownToDoc("1. First\n2. Second\n3. Third");
    const lists = findNodes(doc, "orderedList");
    expect(lists).toHaveLength(1);
    const items = findNodes(doc, "listItem");
    expect(items).toHaveLength(3);
    expect(allText(items[0])).toBe("First");
  });

  it("parses bold text", () => {
    const doc = markdownToDoc("This is **bold** text");
    const paragraphs = findNodes(doc, "paragraph");
    const content = paragraphs[0].content!;
    const boldNode = content.find((n) => n.marks?.some((m) => m.type === "bold"));
    expect(boldNode).toBeDefined();
    expect(boldNode!.text).toBe("bold");
  });

  it("parses italic text", () => {
    const doc = markdownToDoc("This is *italic* text");
    const paragraphs = findNodes(doc, "paragraph");
    const content = paragraphs[0].content!;
    const italicNode = content.find((n) => n.marks?.some((m) => m.type === "italic"));
    expect(italicNode).toBeDefined();
    expect(italicNode!.text).toBe("italic");
  });

  it("parses inline code", () => {
    const doc = markdownToDoc("Use `console.log` here");
    const paragraphs = findNodes(doc, "paragraph");
    const content = paragraphs[0].content!;
    const codeNode = content.find((n) => n.marks?.some((m) => m.type === "code"));
    expect(codeNode).toBeDefined();
    expect(codeNode!.text).toBe("console.log");
  });

  it("parses blockquotes", () => {
    const doc = markdownToDoc("> This is a quote");
    const bqs = findNodes(doc, "blockquote");
    expect(bqs).toHaveLength(1);
    expect(allText(bqs[0])).toBe("This is a quote");
  });

  it("parses horizontal rules", () => {
    const doc = markdownToDoc("Above\n\n---\n\nBelow");
    const hrs = findNodes(doc, "horizontalRule");
    expect(hrs).toHaveLength(1);
  });

  it("degrades code blocks to paragraphs", () => {
    const doc = markdownToDoc("```\nconst x = 1;\n```");
    // Should not have a code_block node (not in our schema)
    const codeBlocks = findNodes(doc, "code_block");
    expect(codeBlocks).toHaveLength(0);
    // Content should be in a paragraph
    const paragraphs = findNodes(doc, "paragraph");
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    const text = paragraphs.map(allText).join("");
    expect(text).toContain("const x = 1;");
  });

  it("returns a valid doc for empty input", () => {
    const doc = markdownToDoc("");
    expect(doc.type).toBe("doc");
    expect(doc.content.length).toBeGreaterThanOrEqual(1);
  });

  it("converts softbreaks to hard breaks", () => {
    const doc = markdownToDoc("**bold**\ncontinuation");
    const paragraphs = findNodes(doc, "paragraph");
    expect(paragraphs).toHaveLength(1);
    const breaks = findNodes(doc, "hardBreak");
    expect(breaks).toHaveLength(1);
  });

  it("still separates paragraphs on double newlines", () => {
    const doc = markdownToDoc("First\n\nSecond");
    const paragraphs = findNodes(doc, "paragraph");
    expect(paragraphs).toHaveLength(2);
  });

  it("parses links", () => {
    const doc = markdownToDoc("Click [here](https://example.com) for more");
    const paragraphs = findNodes(doc, "paragraph");
    const content = paragraphs[0].content!;
    const linkNode = content.find((n) => n.marks?.some((m) => m.type === "link"));
    expect(linkNode).toBeDefined();
    expect(linkNode!.text).toBe("here");
    const linkMark = linkNode!.marks!.find((m) => m.type === "link");
    expect(linkMark!.attrs!.href).toBe("https://example.com");
  });

  it("handles combined markdown features", () => {
    const md = `# Title

A paragraph with **bold** and *italic* text.

- Item 1
- Item 2

> A blockquote

---

Final paragraph.`;
    const doc = markdownToDoc(md);
    expect(doc.type).toBe("doc");
    expect(findNodes(doc, "heading")).toHaveLength(1);
    expect(findNodes(doc, "bulletList")).toHaveLength(1);
    expect(findNodes(doc, "blockquote")).toHaveLength(1);
    expect(findNodes(doc, "horizontalRule")).toHaveLength(1);
  });

});

describe("docToMarkdown", () => {
  it("serializes headings", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Subtitle" }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe("# Title\n\n## Subtitle");
  });

  it("serializes paragraphs", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second paragraph" }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Hello world\n\nSecond paragraph");
  });

  it("serializes bold and italic marks", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This is " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            { type: "text", text: " text" },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("This is **bold** and *italic* text");
  });

  it("serializes inline code", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Use " },
            { type: "text", text: "console.log", marks: [{ type: "code" }] },
            { type: "text", text: " here" },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Use `console.log` here");
  });

  it("serializes bullet lists", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Two" }] }] },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("- One\n- Two");
  });

  it("serializes ordered lists", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { order: 1 },
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }] },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("1. First\n2. Second");
  });

  it("serializes blockquotes", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "A quote" }] }],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("> A quote");
  });

  it("serializes horizontal rules", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Above" }] },
        { type: "horizontalRule" },
        { type: "paragraph", content: [{ type: "text", text: "Below" }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Above\n\n---\n\nBelow");
  });

  it("serializes tracked insertions as [+text+]", () => {
    const doc: DocJson = {
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
    };
    expect(docToMarkdown(doc)).toBe("Hello [+new+] world");
  });

  it("serializes tracked deletions as [-text-]", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "old", marks: [{ type: "deletion" }] },
            { type: "text", text: " world" },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Hello [-old-] world");
  });

  it("serializes links", () => {
    const doc: DocJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Visit " },
            { type: "text", text: "Example", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
            { type: "text", text: " site" },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("Visit [Example](https://example.com) site");
  });

  it("round-trips links through markdown", () => {
    const md = "Click [here](https://example.com) for more";
    const doc = markdownToDoc(md);
    const output = docToMarkdown(doc);
    expect(output).toBe(md);
  });

  it("round-trips headings, bold, italic through markdown", () => {
    const md = "# Title\n\nA **bold** and *italic* paragraph";
    const doc = markdownToDoc(md);
    const output = docToMarkdown(doc);
    expect(output).toBe(md);
  });

  it("round-trips lists through markdown", () => {
    const md = "- One\n- Two\n- Three";
    const doc = markdownToDoc(md);
    const output = docToMarkdown(doc);
    expect(output).toBe(md);
  });
});
