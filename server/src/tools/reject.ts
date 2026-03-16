import { getDocOrThrow, updateAndLog } from "../db.js";
import { rejectTrackedChange } from "../prosemirror/helpers.js";
import type { DocJson } from "../prosemirror/helpers.js";
import { broadcast } from "../ws.js";

export function ezraReject(docId: string, text: string, markType?: "insertion" | "deletion") {
  const doc = getDocOrThrow(docId);
  const content: DocJson = JSON.parse(doc.content);
  const newContent = rejectTrackedChange(content, text, markType);

  updateAndLog(docId, JSON.stringify(newContent), "reject", JSON.stringify({ text, mark_type: markType }));
  broadcast("doc_update", { doc_id: docId, content: newContent }, docId);

  return { success: true, doc_id: docId };
}
