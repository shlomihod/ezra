import { describe, it, expect } from "vitest";
import { SuggestionMode, suggestionModeKey } from "../extensions/suggestionMode";

describe("SuggestionMode extension", () => {
  it("has the correct name", () => {
    expect(SuggestionMode.name).toBe("suggestionMode");
  });

  it("has storage with enabled defaulting to false", () => {
    const addStorage = SuggestionMode.config.addStorage as Function;
    const storage = addStorage.call({});
    expect(storage.enabled).toBe(false);
  });

  it("has addCommands with toggleSuggestionMode", () => {
    const addCommands = SuggestionMode.config.addCommands as Function;
    const commands = addCommands.call({ storage: { enabled: false } });
    expect(commands.toggleSuggestionMode).toBeDefined();
    expect(typeof commands.toggleSuggestionMode).toBe("function");
  });

  it("toggleSuggestionMode flips the enabled flag", () => {
    const storage = { enabled: false };
    const addCommands = SuggestionMode.config.addCommands as Function;
    const commands = addCommands.call({ storage });
    const dispatched: any[] = [];
    const handler = commands.toggleSuggestionMode();
    handler({ tr: {}, dispatch: (tr: any) => dispatched.push(tr) });
    expect(storage.enabled).toBe(true);
    handler({ tr: {}, dispatch: (tr: any) => dispatched.push(tr) });
    expect(storage.enabled).toBe(false);
  });

  it("has addKeyboardShortcuts defined", () => {
    expect(SuggestionMode.config.addKeyboardShortcuts).toBeDefined();
  });

  it("has addProseMirrorPlugins defined", () => {
    expect(SuggestionMode.config.addProseMirrorPlugins).toBeDefined();
  });

  it("exports a PluginKey", () => {
    expect(suggestionModeKey).toBeDefined();
  });

  it("configure returns an extension", () => {
    const ext = SuggestionMode.configure({});
    expect(ext).toBeDefined();
  });
});
