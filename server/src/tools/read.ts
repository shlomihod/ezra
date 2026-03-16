import { getDocOrThrow, getThreadsForDoc } from "../db.js";
import type { DocJson } from "../prosemirror/helpers.js";
import { docToMarkdown } from "../prosemirror/markdown.js";

export function ezraRead(docId: string) {
  const doc = getDocOrThrow(docId);
  const content: DocJson = JSON.parse(doc.content);
  const markdown = docToMarkdown(content);

  const threads = getThreadsForDoc(docId);
  const openThreads = threads.filter((t) => t.status === "open");

  let result = markdown;

  if (openThreads.length > 0) {
    result += "\n\n---\nComment Threads:\n";
    for (const thread of openThreads) {
      result += `\n[${thread.id}] anchor: "${thread.anchor_text}"\n`;
      for (const reply of thread.replies) {
        result += `  ${reply.author}: ${reply.body}\n`;
      }
    }
  }

  return result;
}
