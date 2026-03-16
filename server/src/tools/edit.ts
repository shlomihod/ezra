import { getDocOrThrow, updateAndLog } from "../db.js";
import { replaceText, resolveSpan } from "../prosemirror/helpers.js";
import type { DocJson } from "../prosemirror/helpers.js";
import { broadcast } from "../ws.js";

export function ezraEdit(docId: string, oldStr: string, newStr: string, oldEnd?: string) {
  const doc = getDocOrThrow(docId);
  const content: DocJson = JSON.parse(doc.content);
  const span = resolveSpan(content, oldStr, oldEnd);
  if (!span) throw new Error(`old_string not found in document`);

  const newContent = replaceText(content, newStr, { from: span.from, to: span.to });

  updateAndLog(docId, JSON.stringify(newContent), "edit", JSON.stringify({ old_string: span.text, new_string: newStr }));
  broadcast("doc_update", { doc_id: docId, content: newContent }, docId);

  return { success: true, doc_id: docId };
}
