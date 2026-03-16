import { Mark } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";

/**
 * Markdown-it plugin: tokenizes [+text+] as insertion marks.
 */
function insertionTokenizer(md: MarkdownIt) {
  md.inline.ruler.before("emphasis", "insertion", (state: StateInline, silent: boolean) => {
    const src = state.src;
    const pos = state.pos;
    if (src.charCodeAt(pos) !== 0x5b /* [ */ || src.charCodeAt(pos + 1) !== 0x2b /* + */) return false;
    const end = src.indexOf("+]", pos + 2);
    if (end === -1) return false;
    if (!silent) {
      state.push("insertion_open", "ins", 1).markup = "[+";
      state.push("text", "", 0).content = src.slice(pos + 2, end);
      state.push("insertion_close", "ins", -1).markup = "+]";
    }
    state.pos = end + 2;
    return true;
  });
}

/**
 * Markdown-it plugin: tokenizes [-text-] as deletion marks.
 */
function deletionTokenizer(md: MarkdownIt) {
  md.inline.ruler.before("emphasis", "deletion", (state: StateInline, silent: boolean) => {
    const src = state.src;
    const pos = state.pos;
    if (src.charCodeAt(pos) !== 0x5b /* [ */ || src.charCodeAt(pos + 1) !== 0x2d /* - */) return false;
    const end = src.indexOf("-]", pos + 2);
    if (end === -1) return false;
    if (!silent) {
      state.push("deletion_open", "del", 1).markup = "[-";
      state.push("text", "", 0).content = src.slice(pos + 2, end);
      state.push("deletion_close", "del", -1).markup = "-]";
    }
    state.pos = end + 2;
    return true;
  });
}

export const Insertion = Mark.create({
  name: "insertion",
  parseHTML() {
    return [{ tag: "ins" }];
  },
  renderHTML() {
    return ["ins", { class: "tracked-insertion" }, 0];
  },
  addStorage() {
    return {
      markdown: {
        serialize: { open: "[+", close: "+]" },
        parse: {
          setup(markdownit: MarkdownIt) {
            markdownit.use(insertionTokenizer);
          },
        },
      },
    };
  },
});

export const Deletion = Mark.create({
  name: "deletion",
  parseHTML() {
    return [{ tag: "del" }];
  },
  renderHTML() {
    return ["del", { class: "tracked-deletion" }, 0];
  },
  addStorage() {
    return {
      markdown: {
        serialize: { open: "[-", close: "-]" },
        parse: {
          setup(markdownit: MarkdownIt) {
            markdownit.use(deletionTokenizer);
          },
        },
      },
    };
  },
});

export const serverExtensions = [
  StarterKit.configure({ codeBlock: false, strike: false, link: { openOnClick: false, autolink: false }, underline: false }),
  Insertion,
  Deletion,
];
