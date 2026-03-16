import { listDocuments } from "../db.js";
import { getOpenDocIds } from "../ws.js";

export function ezraList() {
  const docs = listDocuments();
  const openIds = getOpenDocIds();
  return docs.map((d) => ({
    ...d,
    is_open: openIds.has(d.id),
  }));
}
