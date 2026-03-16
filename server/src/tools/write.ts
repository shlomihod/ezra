import { getDocOrThrow, updateAndLog } from "../db.js";
import { markdownToDoc } from "../prosemirror/markdown.js";
import { broadcast } from "../ws.js";

export function ezraWrite(docId: string, content: string) {
  getDocOrThrow(docId);
  const newContent = markdownToDoc(content);

  updateAndLog(docId, JSON.stringify(newContent), "write", JSON.stringify({ content }));
  broadcast("doc_update", { doc_id: docId, content: newContent }, docId);

  return { success: true, doc_id: docId };
}
