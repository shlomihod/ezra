import { nanoid } from "nanoid";
import { createDocument, logOperation } from "../db.js";
import { broadcast } from "../ws.js";

export function ezraCreate(title: string, content?: string) {
  const docId = nanoid(10);
  const docContent = content ?? JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph" }],
  });
  createDocument(docId, title, docContent);
  logOperation("create", docId, JSON.stringify({ title }));
  broadcast("doc_list_update", {}, "");
  return { doc_id: docId, title };
}
