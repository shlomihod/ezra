import { ezraCreate } from "./create.js";
import { getDocOrThrow, updateAndLog } from "../db.js";
import { broadcast } from "../ws.js";
import { textToDoc } from "../prosemirror/helpers.js";
import { markdownToDoc } from "../prosemirror/markdown.js";

export function ezraImport(title: string, content: string, format: "markdown" | "text" = "markdown") {
  const { doc_id } = ezraCreate(title);
  if (content) {
    getDocOrThrow(doc_id);
    const newContent = format === "text" ? textToDoc(content) : markdownToDoc(content);
    updateAndLog(doc_id, JSON.stringify(newContent), "write", JSON.stringify({ content }));
    broadcast("doc_update", { doc_id, content: newContent }, doc_id);
  }
  return { doc_id, title };
}
