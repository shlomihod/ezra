import { Node, Fragment, Mark } from "prosemirror-model";
import { schema } from "./schema.js";

export interface NodeJson {
  type: string;
  content?: NodeJson[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

export interface DocJson {
  type: "doc";
  content: NodeJson[];
}

/**
 * Convert plain text to a ProseMirror doc JSON object.
 * Each line becomes a paragraph; empty lines become empty paragraphs.
 */
export function textToDoc(text: string): DocJson {
  const lines = text.split("\n");
  const paragraphs: NodeJson[] = lines.map((line) => {
    if (line.length === 0) {
      return { type: "paragraph" };
    }
    return {
      type: "paragraph",
      content: [{ type: "text", text: line }],
    };
  });
  return { type: "doc", content: paragraphs };
}

/**
 * Extract lines of text from a ProseMirror doc JSON.
 * Each textblock becomes one line.
 */
function extractLines(docJson: DocJson): string[] {
  const doc = Node.fromJSON(schema, docJson);
  const lines: string[] = [];
  doc.descendants((node) => {
    if (node.isBlock && node.isTextblock) {
      lines.push(node.textContent);
      return false;
    }
    return true;
  });
  return lines;
}

/**
 * Extract plain text without line numbers, for search operations.
 */
export function extractPlainText(docJson: DocJson): string {
  return extractLines(docJson).join("\n");
}

/**
 * Resolve a text span within the doc, identified by a `start` string and an optional `end` string.
 * Returns `{ from, to, text }` or null if `start` is not found.
 * Throws if not unique, if `end` doesn't appear after `start`, or if the span crosses paragraphs.
 */
export function resolveSpan(
  docJson: DocJson,
  start: string,
  end?: string
): { from: number; to: number; text: string } | null {
  const fullText = extractPlainText(docJson);

  if (!end) {
    const firstIdx = fullText.indexOf(start);
    if (firstIdx === -1) return null;
    if (fullText.indexOf(start, firstIdx + 1) !== -1) {
      throw new Error(`Text is not unique in the document — found at multiple positions. Use a longer or more specific string.`);
    }
    const range = mapRangeToPositions(docJson, firstIdx, firstIdx + start.length);
    return { ...range, text: start };
  }

  const startFirst = fullText.indexOf(start);
  if (startFirst === -1) return null;
  if (fullText.indexOf(start, startFirst + 1) !== -1) {
    throw new Error(`Start text is not unique in the document — found at multiple positions. Use a longer or more specific string.`);
  }

  const endFirst = fullText.indexOf(end, startFirst + start.length);
  if (endFirst === -1) {
    throw new Error(`End text not found after start text in the document.`);
  }
  if (fullText.indexOf(end, endFirst + 1) !== -1) {
    throw new Error(`End text is not unique in the document — found at multiple positions. Use a longer or more specific string.`);
  }

  const spanStart = startFirst;
  const spanEnd = endFirst + end.length;
  const text = fullText.slice(spanStart, spanEnd);
  const range = mapRangeToPositions(docJson, spanStart, spanEnd);
  return { ...range, text };
}

/**
 * Map a character range to ProseMirror positions.
 * Throws if the range crosses paragraph boundaries.
 */
function mapRangeToPositions(
  docJson: DocJson,
  startIdx: number,
  endIdx: number
): { from: number; to: number } {
  const doc = Node.fromJSON(schema, docJson);
  let charOffset = 0;
  let from: number | null = null;
  let to: number | null = null;

  doc.descendants((node, pos) => {
    if (from !== null && to !== null) return false;
    if (node.isTextblock) {
      const text = node.textContent;
      const blockStart = charOffset;
      const blockEnd = charOffset + text.length;

      if (startIdx < blockEnd && endIdx > blockStart) {
        if (from === null && startIdx >= blockStart && startIdx < blockEnd) {
          from = pos + 1 + (startIdx - blockStart);
        }
        if (endIdx <= blockEnd) {
          to = pos + 1 + (endIdx - blockStart);
        }
      }

      charOffset = blockEnd + 1;
      return false;
    }
    return true;
  });

  if (from !== null && to !== null) return { from, to };
  if (from !== null) {
    throw new Error(`Text span crosses paragraph boundaries, which is not supported. Keep start and end within the same paragraph.`);
  }
  throw new Error(`Could not map text position in document.`);
}

/**
 * Replace a range in a ProseMirror doc with new inline nodes.
 * Used by both replaceText (plain text) and applyDiffMarks (tracked changes).
 */
function spliceDocRange(doc: Node, from: number, to: number, newNodes: Node[]): Node {
  const children: Node[] = [];
  let replaced = false;

  doc.forEach((child, childOffset) => {
    if (child.isTextblock && !replaced) {
      const tbContentStart = childOffset + 1;
      if (from >= childOffset && from < childOffset + child.nodeSize &&
          to >= childOffset && to <= childOffset + child.nodeSize) {
        children.push(spliceTextblock(child, from - tbContentStart, to - tbContentStart, newNodes));
        replaced = true;
        return;
      }
    }
    children.push(child);
  });

  return doc.copy(Fragment.from(children));
}

/**
 * Replace text in a ProseMirror doc JSON.
 * Requires a pre-computed range from resolveSpan.
 */
export function replaceText(
  docJson: DocJson,
  newStr: string,
  range: { from: number; to: number }
): DocJson {
  const doc = Node.fromJSON(schema, docJson);
  const newNodes = newStr.length > 0 ? [schema.text(newStr)] : [];
  return spliceDocRange(doc, range.from, range.to, newNodes).toJSON() as DocJson;
}

/**
 * Replace a character range within a textblock with new inline nodes.
 * Handles text spanning across multiple inline nodes with different marks.
 */
function spliceTextblock(
  textblock: Node,
  relFrom: number,
  relTo: number,
  replacementNodes: Node[]
): Node {
  const segments: { text: string; marks: readonly Mark[] }[] = [];
  textblock.forEach((child) => {
    if (child.isText) {
      segments.push({ text: child.text!, marks: child.marks });
    }
  });

  const inlineNodes: Node[] = [];
  let charPos = 0;
  let insertedReplacement = false;

  for (const seg of segments) {
    const segStart = charPos;
    const segEnd = charPos + seg.text.length;

    if (segEnd <= relFrom || segStart >= relTo) {
      inlineNodes.push(schema.text(seg.text, seg.marks));
    } else {
      if (segStart < relFrom) {
        inlineNodes.push(schema.text(seg.text.slice(0, relFrom - segStart), seg.marks));
      }
      if (!insertedReplacement) {
        inlineNodes.push(...replacementNodes);
        insertedReplacement = true;
      }
      if (segEnd > relTo) {
        inlineNodes.push(schema.text(seg.text.slice(relTo - segStart), seg.marks));
      }
    }

    charPos = segEnd;
  }

  const content = inlineNodes.length > 0 ? Fragment.from(inlineNodes) : Fragment.empty;
  return textblock.copy(content);
}

/**
 * Apply insertion and deletion marks based on diff operations.
 * Requires a pre-computed range from resolveSpan.
 */
export function applyDiffMarks(
  docJson: DocJson,
  diffs: [number, string][],
  range: { from: number; to: number }
): DocJson {
  const doc = Node.fromJSON(schema, docJson);
  const insertionMark = schema.marks.insertion.create();
  const deletionMark = schema.marks.deletion.create();

  const newNodes: Node[] = [];
  for (const [op, text] of diffs) {
    if (text.length === 0) continue;
    if (op === 0) {
      newNodes.push(schema.text(text));
    } else if (op === 1) {
      newNodes.push(schema.text(text, [insertionMark]));
    } else if (op === -1) {
      newNodes.push(schema.text(text, [deletionMark]));
    }
  }

  return spliceDocRange(doc, range.from, range.to, newNodes).toJSON() as DocJson;
}

/**
 * Accept a tracked change: insertion marks are stripped (text kept), deletion nodes are removed.
 */
export function acceptTrackedChange(docJson: DocJson, text: string, markType?: "insertion" | "deletion"): DocJson {
  return resolveTrackedChange(docJson, text, "accept", markType);
}

/**
 * Reject a tracked change: insertion nodes are removed, deletion marks are stripped (text kept).
 */
export function rejectTrackedChange(docJson: DocJson, text: string, markType?: "insertion" | "deletion"): DocJson {
  return resolveTrackedChange(docJson, text, "reject", markType);
}

function resolveTrackedChange(
  docJson: DocJson,
  text: string,
  action: "accept" | "reject",
  markType?: "insertion" | "deletion"
): DocJson {
  const doc = Node.fromJSON(schema, docJson);

  const matches: { node: Node; pos: number; type: "insertion" | "deletion" }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text === text) {
      const hasInsertion = node.marks.some((m) => m.type.name === "insertion");
      const hasDeletion = node.marks.some((m) => m.type.name === "deletion");
      if (hasInsertion && (!markType || markType === "insertion")) {
        matches.push({ node, pos, type: "insertion" });
      } else if (hasDeletion && (!markType || markType === "deletion")) {
        matches.push({ node, pos, type: "deletion" });
      }
    }
    return true;
  });

  if (matches.length === 0) {
    throw new Error(`No tracked change found matching text: "${text}"`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple tracked changes match text: "${text}". Specify mark_type ("insertion" or "deletion") to disambiguate.`
    );
  }

  const match = matches[0];
  const keepText =
    (action === "accept" && match.type === "insertion") ||
    (action === "reject" && match.type === "deletion");

  return rebuildWithResolve(doc, text, match.type, keepText).toJSON() as DocJson;
}

function rebuildWithResolve(
  node: Node,
  text: string,
  changeType: "insertion" | "deletion",
  keepText: boolean
): Node {
  const children: Node[] = [];
  node.forEach((child) => {
    if (child.isTextblock) {
      children.push(resolveInTextblock(child, text, changeType, keepText));
    } else if (child.childCount > 0) {
      children.push(rebuildWithResolve(child, text, changeType, keepText));
    } else {
      children.push(child);
    }
  });
  return node.copy(Fragment.from(children));
}

function resolveInTextblock(
  textblock: Node,
  text: string,
  changeType: "insertion" | "deletion",
  keepText: boolean
): Node {
  const inlineNodes: Node[] = [];
  let found = false;

  textblock.forEach((child) => {
    if (!found && child.isText && child.text === text) {
      const hasMark = child.marks.some((m) => m.type.name === changeType);
      if (hasMark) {
        found = true;
        if (keepText) {
          const newMarks = child.marks.filter((m) => m.type.name !== changeType);
          inlineNodes.push(schema.text(child.text!, newMarks));
        }
        return;
      }
    }
    inlineNodes.push(child);
  });

  const content = inlineNodes.length > 0 ? Fragment.from(inlineNodes) : Fragment.empty;
  return textblock.copy(content);
}
