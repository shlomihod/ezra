import { describe, it, expect } from "vitest";
import { EzraShortcuts } from "../extensions/shortcuts";

describe("EzraShortcuts extension", () => {
  it("has the correct name", () => {
    expect(EzraShortcuts.name).toBe("ezraShortcuts");
  });

  it("has addKeyboardShortcuts defined", () => {
    expect(EzraShortcuts.config.addKeyboardShortcuts).toBeDefined();
  });

  it("has addOptions with onAddComment default", () => {
    const addOptions = EzraShortcuts.config.addOptions as Function;
    const options = addOptions.call({});
    expect(options.onAddComment).toBeDefined();
    expect(typeof options.onAddComment).toBe("function");
  });

  it("has addOptions with onAddLink default", () => {
    const addOptions = EzraShortcuts.config.addOptions as Function;
    const options = addOptions.call({});
    expect(options.onAddLink).toBeDefined();
    expect(typeof options.onAddLink).toBe("function");
  });

  it("configure returns an extension", () => {
    const fn = () => {};
    const ext = EzraShortcuts.configure({ onAddComment: fn, onAddLink: fn });
    expect(ext).toBeDefined();
  });
});
