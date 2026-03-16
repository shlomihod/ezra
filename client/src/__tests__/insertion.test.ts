import { describe, it, expect } from "vitest";
import { Insertion } from "../extensions/insertion";
import { Deletion } from "../extensions/deletion";

describe("Insertion mark", () => {
  it("renderHTML returns ins tag with class and hole", () => {
    const ext = Insertion.config;
    // renderHTML expects (this, mark) but our implementation ignores both
    const result = (ext.renderHTML as Function).call({}, {});
    expect(result).toEqual(["ins", { class: "tracked-insertion" }, 0]);
  });

  it("renderHTML does not spread HTMLAttributes into the tag", () => {
    const ext = Insertion.config;
    const result = (ext.renderHTML as Function).call({}, {}) as unknown[];
    // The attributes object should only have 'class', not arbitrary HTML attributes
    const attrs = result[1] as Record<string, unknown>;
    expect(Object.keys(attrs)).toEqual(["class"]);
  });

  it("parseHTML matches ins tag", () => {
    const ext = Insertion.config;
    const rules = ext.parseHTML!.call({} as any);
    expect(rules).toEqual([{ tag: "ins" }]);
  });
});

describe("Deletion mark", () => {
  it("renderHTML returns del tag with class and hole", () => {
    const ext = Deletion.config;
    const result = (ext.renderHTML as Function).call({}, {});
    expect(result).toEqual(["del", { class: "tracked-deletion" }, 0]);
  });

  it("renderHTML does not spread HTMLAttributes into the tag", () => {
    const ext = Deletion.config;
    const result = (ext.renderHTML as Function).call({}, {}) as unknown[];
    const attrs = result[1] as Record<string, unknown>;
    expect(Object.keys(attrs)).toEqual(["class"]);
  });
});
