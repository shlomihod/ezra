import { describe, it, expect } from "vitest";
import { computeDiffs } from "../prosemirror/diff.js";

describe("computeDiffs", () => {
  it("returns equal op for identical strings", () => {
    const diffs = computeDiffs("hello", "hello");
    expect(diffs).toEqual([[0, "hello"]]);
  });

  it("detects insertions", () => {
    const diffs = computeDiffs("hello", "hello world");
    const hasInsert = diffs.some(([op]) => op === 1);
    expect(hasInsert).toBe(true);
    // Reconstructing new string from diffs
    const newStr = diffs
      .filter(([op]) => op >= 0)
      .map(([, text]) => text)
      .join("");
    expect(newStr).toBe("hello world");
  });

  it("detects deletions", () => {
    const diffs = computeDiffs("hello world", "hello");
    const hasDelete = diffs.some(([op]) => op === -1);
    expect(hasDelete).toBe(true);
    // Reconstructing old string from diffs
    const oldStr = diffs
      .filter(([op]) => op <= 0)
      .map(([, text]) => text)
      .join("");
    expect(oldStr).toBe("hello world");
  });

  it("handles complete replacement", () => {
    const diffs = computeDiffs("abc", "xyz");
    const hasDelete = diffs.some(([op]) => op === -1);
    const hasInsert = diffs.some(([op]) => op === 1);
    expect(hasDelete).toBe(true);
    expect(hasInsert).toBe(true);
  });

  it("handles empty strings", () => {
    expect(computeDiffs("", "")).toEqual([]);
    const diffs = computeDiffs("", "new");
    expect(diffs).toEqual([[1, "new"]]);
  });
});
