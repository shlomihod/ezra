import { nanoid } from "nanoid";
import { getDocOrThrow, createDocument, logOperation } from "../db.js";
import { broadcast } from "../ws.js";

export function ezraDuplicate(docId: string, title?: string) {
  const doc = getDocOrThrow(docId);
  const newId = nanoid(10);
  const newTitle = title ?? doc.title;
  createDocument(newId, newTitle, doc.content);
  logOperation("duplicate", newId, JSON.stringify({ source_doc_id: docId }));
  broadcast("doc_list_update", {}, "");
  return { doc_id: newId, title: newTitle, source_doc_id: docId };
}
