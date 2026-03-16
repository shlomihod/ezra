import { JSDOM } from "jsdom";
import { Editor } from "@tiptap/core";
import { Markdown } from "tiptap-markdown";
import type { MarkdownStorage } from "tiptap-markdown";
import { serverExtensions } from "./extensions.js";
import type { DocJson } from "./helpers.js";

/**
 * TipTap types editor.storage as the Web API Storage interface.
 * At runtime it is a Record<extensionName, extensionStorage>.
 */
function getMarkdownStorage(editor: Editor): MarkdownStorage {
  return (editor.storage as unknown as Record<string, MarkdownStorage>).markdown;
}

// Lazy singleton — defers JSDOM + Editor creation to first use
let _editor: Editor | null = null;

function getEditor(): Editor {
  if (!_editor) {
    // Polyfill DOM globals for tiptap-markdown (browser-oriented library).
    // Overwrites globalThis.Node (DOM Node, not Node.js) intentionally.
    if (typeof globalThis.window === "undefined") {
      const dom = new JSDOM();
      Object.assign(globalThis, {
        window: dom.window,
        document: dom.window.document,
        Node: dom.window.Node,
      });
    }
    _editor = new Editor({
      extensions: [
        ...serverExtensions,
        Markdown.configure({
          html: false,
          tightLists: true,
          bulletListMarker: "-",
          breaks: true,
        }),
      ],
    });
  }
  return _editor;
}

/**
 * Parse markdown string into a ProseMirror DocJson matching our schema.
 */
export function markdownToDoc(markdown: string): DocJson {
  if (!markdown) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  const editor = getEditor();
  editor.commands.setContent(markdown);
  return editor.getJSON() as DocJson;
}

/**
 * Convert a ProseMirror doc JSON to a Markdown string.
 * Tracked insertions render as [+text+], deletions as [-text-].
 */
export function docToMarkdown(docJson: DocJson): string {
  const editor = getEditor();
  editor.commands.setContent(docJson);
  return getMarkdownStorage(editor).getMarkdown().trimEnd();
}
